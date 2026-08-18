/**
 * Deadline reminder trigger.
 *
 * A separate Worker on purpose. The main app is built by OpenNext, whose
 * generated worker exports only a fetch handler; wrapping it to add a
 * `scheduled` export means owning a custom entry point that the build
 * regenerates, and a mistake there breaks every deploy. This does one thing —
 * call the reminders endpoint once a day — and cannot take the site down.
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

async function runReminders(env: Env): Promise<string> {
  if (!env.APP_URL || !env.CRON_SECRET) {
    return "APP_URL or CRON_SECRET is not set";
  }

  const res = await fetch(`${env.APP_URL}/api/cron/reminders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CRON_SECRET}`,
      "content-type": "application/json",
    },
    // The endpoint walks every tender and may send several emails; a short
    // timeout would abandon a run that was going to succeed.
    signal: AbortSignal.timeout(60_000),
  });

  const body = await res.text().catch(() => "");
  return `${res.status} ${body.slice(0, 300)}`;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runReminders(env)
        .then((result) => console.log("[cron] reminders:", result))
        .catch((err) => console.error("[cron] reminders failed:", err))
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
    return new Response(await runReminders(env));
  },
};
