/**
 * Daily notification trigger.
 *
 * A separate Worker on purpose. The main app is built by OpenNext, whose
 * generated worker exports only a fetch handler; wrapping it to add a
 * `scheduled` export means owning a custom entry point that the build
 * regenerates, and a mistake there breaks every deploy. This only calls two
 * endpoints once a day and cannot take the site down.
 *
 * Cron Triggers are included on the Workers free plan; a daily trigger is
 * about 30 requests a month.
 */

interface Env {
  /** Where the app lives, e.g. https://skrubbit.co.za */
  APP_URL: string;
  /** Must match CRON_SECRET on the main Worker. */
  CRON_SECRET: string;
}

async function call(env: Env, path: string, timeoutMs: number): Promise<string> {
  const res = await fetch(`${env.APP_URL}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CRON_SECRET}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await res.text().catch(() => "");
  return `${res.status} ${body.slice(0, 300)}`;
}

/**
 * The daily pass: top up the mirror with the last few days of adverts, then
 * send.
 *
 * In that order, because the new-tender digest can only announce what has been
 * mirrored. The sync is allowed to fail without taking the reminders with it —
 * a deadline warning matters more than a fresh advert, and the eTenders feed is
 * unreliable enough that a failed poll is routine.
 */
async function runDaily(env: Env): Promise<string> {
  if (!env.APP_URL || !env.CRON_SECRET) {
    return "APP_URL or CRON_SECRET is not set";
  }

  let sync: string;
  try {
    // Walks the last few days of the feed a page at a time, and the feed is
    // slow: a live run took 182s. Generous on purpose — cutting it off wastes
    // the pages it had left rather than saving anything.
    sync = await call(env, "/api/cron/sync-recent", 500_000);
  } catch (err) {
    sync = `failed: ${String(err).slice(0, 200)}`;
  }

  // Walks every tender and may send several emails; a short timeout would
  // abandon a run that was going to succeed.
  const reminders = await call(env, "/api/cron/reminders", 120_000);
  return `sync ${sync} | reminders ${reminders}`;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runDaily(env)
        .then((result) => console.log("[cron] daily:", result))
        .catch((err) => console.error("[cron] daily run failed:", err))
    );
  },

  /**
   * Manual trigger, so a run can be tested without waiting for the schedule.
   * Guarded by the same secret as the endpoint it calls.
   */
  async fetch(req: Request, env: Env): Promise<Response> {
    const supplied =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!env.CRON_SECRET || supplied !== env.CRON_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response(await runDaily(env));
  },
};
