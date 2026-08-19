/**
 * The daily run's own record, and what to say about it.
 *
 * The reminders pass and the advert digest both send only when they have
 * something to send, which is right — nobody wants a daily email saying
 * nothing happened. The cost is that silence carries no information: a morning
 * with no new adverts and no deadline crossing a threshold looks exactly like
 * a cron that stopped firing a week ago.
 *
 * This closes that gap from both ends. Every run writes a row here whatever
 * it did, so the dashboard can always answer "did it run?", and a run with
 * nothing to report still sends one short line, so the inbox can answer it too.
 *
 * The run is reported from the cron worker rather than recorded by the
 * endpoints themselves, because the failure worth catching is a reminders pass
 * that dies mid-flight, and a dead endpoint cannot record its own death.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** One leg of the daily pass, as the cron worker saw it. */
export interface LegReport {
  /** HTTP status, or 0 when the request never completed at all. */
  status: number;
  /** Response body, trimmed. The thrown error instead, when status is 0. */
  body: string;
}

export interface RunReport {
  sync: LegReport;
  reminders: LegReport;
}

export interface CronRun {
  ranAt: string;
  ok: boolean;
  syncOk: boolean;
  sent: number;
  announced: number;
  failed: number;
  checked: number;
  detail: string;
}

/**
 * Whether a run with nothing to report still sends its one-line confirmation.
 *
 * On by default: the whole point is that silence is ambiguous. Set to false if
 * the daily line becomes noise — the dashboard strip keeps working either way,
 * and failures are still emailed regardless of this setting.
 */
const QUIET_DAY_EMAIL = true;

/** A run is overdue once this many hours have passed. The schedule is daily,
 *  so 26 leaves room for a late start without crying wolf. */
export const OVERDUE_HOURS = 26;

/** Two runs further apart than this had a gap worth mentioning. */
const GAP_HOURS = 36;

/** Runs kept before pruning. Long enough to see a pattern, short enough that
 *  the table never needs thinking about again. */
const KEEP_DAYS = 180;

const db = () => getCloudflareContext().env.DB;

/** "2026-08-19 06:00:42" (UTC, as SQLite writes it) as a Date. The Z matters:
 *  without it this is parsed as local time, which is only accidentally right. */
export function parseStamp(stamp: string): Date {
  return new Date(`${stamp.replace(" ", "T")}Z`);
}

/** A stored UTC stamp as SAST wall-clock "YYYY-MM-DD HH:MM", matching how
 *  every other time in the admin is shown. */
export function sastStamp(stamp: string): string {
  const shifted = new Date(parseStamp(stamp).getTime() + 2 * 36e5);
  return `${shifted.toISOString().slice(0, 10)} ${shifted.toISOString().slice(11, 16)}`;
}

export function hoursSince(stamp: string, now: Date = new Date()): number {
  return (now.getTime() - parseStamp(stamp).getTime()) / 36e5;
}

/** What the reminders endpoint answers with on a good run. */
interface RemindersBody {
  ok?: boolean;
  sent?: number;
  failed?: number;
  checked?: number;
  announced?: number;
  skipped?: string;
}

/**
 * Reads the two legs into one verdict.
 *
 * A 200 is not on its own a success: the reminders endpoint answers 200 with a
 * `skipped` note when there is no notification address or no mail provider, and
 * that state means no reminder will ever be delivered. Silently treating it as
 * a healthy run is precisely the failure this file exists to prevent.
 */
export function summariseRun(report: RunReport, ranAt: string): CronRun {
  const { sync, reminders } = report;
  const syncOk = sync.status === 200;

  let body: RemindersBody = {};
  try {
    body = JSON.parse(reminders.body) as RemindersBody;
  } catch {
    // Left empty: a body that will not parse is itself the failure, and the
    // raw text goes into `detail` below where it can be read.
  }

  const notes: string[] = [];
  let ok = true;

  if (reminders.status === 0) {
    ok = false;
    notes.push(`reminders did not complete: ${reminders.body}`);
  } else if (reminders.status !== 200) {
    ok = false;
    notes.push(`reminders returned ${reminders.status}: ${reminders.body.slice(0, 200)}`);
  } else if (body.skipped) {
    ok = false;
    notes.push(`nothing could be sent: ${body.skipped}`);
  } else if (body.ok !== true) {
    ok = false;
    notes.push(`reminders answered unexpectedly: ${reminders.body.slice(0, 200)}`);
  }

  if (body.failed) {
    ok = false;
    notes.push(`${body.failed} message(s) failed to send`);
  }

  if (!syncOk) {
    notes.push(
      sync.status === 0
        ? `feed poll did not complete: ${sync.body.slice(0, 160)}`
        : `feed poll returned ${sync.status}`
    );
  }

  return {
    ranAt,
    ok,
    syncOk,
    sent: body.sent ?? 0,
    announced: body.announced ?? 0,
    failed: body.failed ?? 0,
    checked: body.checked ?? 0,
    detail: notes.join("; ").slice(0, 500),
  };
}

/** The most recent run, or null before the first one is recorded. */
export async function lastRun(): Promise<CronRun | null> {
  const row = await db()
    .prepare(
      `SELECT ran_at, ok, sync_ok, sent, announced, failed, checked, detail
         FROM cron_runs ORDER BY ran_at DESC LIMIT 1`
    )
    .first<{
      ran_at: string;
      ok: number;
      sync_ok: number;
      sent: number;
      announced: number;
      failed: number;
      checked: number;
      detail: string;
    }>();

  if (!row) return null;
  return {
    ranAt: row.ran_at,
    ok: Boolean(row.ok),
    syncOk: Boolean(row.sync_ok),
    sent: row.sent,
    announced: row.announced,
    failed: row.failed,
    checked: row.checked,
    detail: row.detail,
  };
}

/** Writes the run and prunes anything long past being useful. */
export async function recordRun(run: CronRun): Promise<void> {
  const d = db();
  await d.batch([
    d
      .prepare(
        // ran_at is bound rather than defaulted so the ledger and the email
        // that reports the same run agree to the second.
        `INSERT INTO cron_runs (ran_at, ok, sync_ok, sent, announced, failed, checked, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        run.ranAt,
        run.ok ? 1 : 0,
        run.syncOk ? 1 : 0,
        run.sent,
        run.announced,
        run.failed,
        run.checked,
        run.detail
      ),
    d.prepare(`DELETE FROM cron_runs WHERE ran_at < datetime('now', ?)`).bind(
      `-${KEEP_DAYS} days`
    ),
  ]);
}

export interface RunMessage {
  subject: string;
  html: string;
  text: string;
}

/**
 * What to email about this run, or null when the run speaks for itself.
 *
 * Nothing is sent when the pass already sent something: a morning that
 * delivered two deadline warnings has proved it is alive, and a summary on top
 * of them is the noise that gets the whole sender filtered.
 */
export function runMessage(run: CronRun, previous: CronRun | null): RunMessage | null {
  const failed = !run.ok || !run.syncOk;
  const quiet = run.sent === 0 && run.announced === 0;

  if (!failed && !quiet) return null;
  if (!failed && !QUIET_DAY_EMAIL) return null;

  // A gap is worth saying out loud even on an otherwise healthy run: it is the
  // evidence that something was wrong on the days nobody was told about.
  const gap =
    previous && hoursSince(previous.ranAt, parseStamp(run.ranAt)) > GAP_HOURS
      ? `No run completed between ${sastStamp(previous.ranAt)} and now — reminders due in that window were not sent.`
      : "";

  const when = sastStamp(run.ranAt);
  const lines: string[] = [];

  if (run.ok) {
    lines.push(`${run.checked} bid${run.checked === 1 ? "" : "s"} checked, nothing due.`);
  } else {
    lines.push(run.detail || "The run did not complete.");
  }
  if (!run.syncOk && run.ok) {
    lines.push("The tender feed could not be polled, so new adverts may be missing.");
  }
  if (run.sent || run.announced) {
    lines.push(`${run.sent} reminder(s) and ${run.announced} new advert(s) went out separately.`);
  }
  if (gap) lines.push(gap);

  const subject = failed
    ? "Skrubbit: the daily tender check had a problem"
    : "Skrubbit: nothing due today";

  const html =
    `<p><strong>Daily tender check — ${when}</strong></p>` +
    lines.map((line) => `<p>${line}</p>`).join("") +
    (failed
      ? `<p>Nothing was necessarily lost, but the run should be looked at: a deadline warning that cannot send is the one failure worth chasing.</p>`
      : "");

  const text = [`Daily tender check - ${when}`, "", ...lines].join("\n");

  return { subject, html, text };
}
