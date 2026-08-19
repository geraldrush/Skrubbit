import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getCompanyProfile } from "@/lib/company";
import { requireCron } from "@/lib/cron-auth";
import {
  lastRun,
  recordRun,
  runMessage,
  summariseRun,
  type LegReport,
  type RunReport,
} from "@/lib/cron-runs";
import { emailConfigured, parseRecipients, sendEmail } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Records how the daily pass went, and says so when it needs saying.
 *
 * Called by the cron worker after the other two, with what each of them
 * answered. It is deliberately the cron worker's job to report rather than
 * each endpoint's job to log itself: the failure this exists to catch is a
 * reminders pass that returns 500 or never returns at all, and neither of
 * those can write its own epitaph.
 *
 * This endpoint stays as close to un-failable as it can. It does no feed work,
 * sends at most one short message, and records the run before attempting that
 * send, so a mail provider having a bad morning still leaves the evidence in
 * the ledger and on the dashboard.
 */

function leg(value: unknown): LegReport {
  const raw = (value ?? {}) as { status?: unknown; body?: unknown };
  const status = typeof raw.status === "number" ? raw.status : 0;
  const body = typeof raw.body === "string" ? raw.body : "";
  return { status, body: body.slice(0, 1000) };
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = requireCron(req, env as { CRON_SECRET?: string });
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // An unreadable report is itself a fact worth recording: both legs come
    // back as "did not complete", which is honest about what we know.
  }

  const report: RunReport = { sync: leg(body.sync), reminders: leg(body.reminders) };

  // Read before writing: the previous run is what makes a missed day visible.
  const previous = await lastRun();

  const now = new Date();
  const ranAt = now.toISOString().slice(0, 19).replace("T", " ");
  const run = summariseRun(report, ranAt);

  await recordRun(run);

  const message = runMessage(run, previous);
  let emailed = false;

  if (message) {
    const profile = await getCompanyProfile();
    const recipients = parseRecipients(profile.notifyEmail || profile.email);

    if (recipients.length && emailConfigured(env)) {
      const result = await sendEmail(env, {
        to: recipients,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      emailed = result.ok;
      if (!result.ok) console.error("[heartbeat] could not send", result.detail);
    } else {
      // Nowhere to send to is exactly the misconfiguration that makes the
      // whole notification path silent, so it goes in the log at least.
      console.error("[heartbeat] no recipient or no mail provider configured");
    }
  }

  return Response.json({ ok: true, run, emailed });
}
