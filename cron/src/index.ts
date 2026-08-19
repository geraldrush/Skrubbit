/**
 * Daily notification trigger.
 *
 * A separate Worker on purpose. The main app is built by OpenNext, whose
 * generated worker exports only a fetch handler; wrapping it to add a
 * `scheduled` export means owning a custom entry point that the build
 * regenerates, and a mistake there breaks every deploy. This only calls three
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

/** What one call answered. status 0 means it never completed at all. */
interface Leg {
  status: number;
  body: string;
}

async function call(
  env: Env,
  path: string,
  timeoutMs: number,
  payload?: unknown
): Promise<Leg> {
  try {
    const res = await fetch(`${env.APP_URL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CRON_SECRET}`,
        "content-type": "application/json",
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const body = await res.text().catch(() => "");
    // Enough to carry the reminders endpoint's JSON summary intact, and to
    // make an error page readable, without pushing a whole HTML document
    // through the heartbeat.
    return { status: res.status, body: body.slice(0, 1000) };
  } catch (err) {
    // Returned rather than thrown: a leg that times out must not take the
    // heartbeat with it, because a run that died is the run most worth
    // recording.
    return { status: 0, body: String(err).slice(0, 300) };
  }
}

/**
 * The daily pass: top up the mirror with the last few days of adverts, send,
 * then report what happened.
 *
 * In that order, because the new-tender digest can only announce what has been
 * mirrored. The sync is allowed to fail without taking the reminders with it —
 * a deadline warning matters more than a fresh advert, and the eTenders feed is
 * unreliable enough that a failed poll is routine.
 *
 * The heartbeat goes last and is given what the other two answered. It is the
 * only leg that runs unconditionally on their behalf: a morning where the
 * reminders pass 500s sends no email of its own, and without this the failure
 * would look exactly like a quiet day.
 */
async function runDaily(env: Env): Promise<string> {
  if (!env.APP_URL || !env.CRON_SECRET) {
    return "APP_URL or CRON_SECRET is not set";
  }

  // Walks the last few days of the feed a page at a time, and the feed is
  // slow: a live run took 182s. Generous on purpose — cutting it off wastes
  // the pages it had left rather than saving anything.
  const sync = await call(env, "/api/cron/sync-recent", 500_000);

  // Walks every tender and may send several emails; a short timeout would
  // abandon a run that was going to succeed.
  const reminders = await call(env, "/api/cron/reminders", 120_000);

  // Writes one row and sends at most one short message, so it needs nothing
  // like the budget the other two do.
  const heartbeat = await call(env, "/api/cron/heartbeat", 30_000, { sync, reminders });

  return (
    `sync ${sync.status} | reminders ${reminders.status} ` +
    `| heartbeat ${heartbeat.status} ${heartbeat.body.slice(0, 200)}`
  );
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
   * Guarded by the same secret as the endpoints it calls.
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
