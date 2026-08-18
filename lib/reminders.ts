/**
 * Which deadline reminders are due.
 *
 * Pure, so the thresholds can be tested without a database or a mail provider.
 * The cron endpoint supplies the data and does the sending.
 */

import {
  assessTender,
  formatDateTime,
  summarise,
  type CompanyDocument,
  type Tender,
  type TenderItem,
} from "@/lib/tenders";

export type ReminderKind =
  | "briefing"
  | "closing_10d"
  | "closing_7d"
  | "closing_48h"
  | "closing_24h";

export interface DueReminder {
  tenderId: number;
  kind: ReminderKind;
  subject: string;
  html: string;
  text: string;
}

const hoursUntil = (iso: string, now: Date) =>
  (new Date(iso).getTime() - now.getTime()) / 36e5;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Reminders this tender has earned but not yet been sent.
 *
 * Thresholds are "at or past", not "exactly at": the cron runs daily, so a
 * 48-hour warning fires on the first run inside 48 hours. `alreadySent` is what
 * stops it firing again every day after that — without it, a tender closing in
 * a week would send the same warning seven times.
 */
export function dueReminders(
  tender: Tender,
  items: TenderItem[],
  documents: CompanyDocument[],
  alreadySent: Set<ReminderKind>,
  baseUrl: string,
  now: Date = new Date()
): DueReminder[] {
  const out: DueReminder[] = [];

  // Only bids still being worked on. A submitted, won, lost or abandoned
  // tender has no deadline left to warn about.
  if (tender.status !== "preparing") return out;

  const readiness = summarise(assessTender(tender, items, documents, now));
  const link = `${baseUrl}/admin/tenders/${tender.id}`;

  const body = (headline: string, urgency: string) => {
    const blockers = readiness.blockers
      ? `<p><strong>${readiness.blockers} blocker${readiness.blockers === 1 ? "" : "s"}</strong> outstanding — this bid would be disqualified as it stands.</p>`
      : `<p>No blockers outstanding.</p>`;
    const blockersText = readiness.blockers
      ? `${readiness.blockers} blocker(s) outstanding - this bid would be disqualified as it stands.`
      : "No blockers outstanding.";

    return {
      html:
        `<p>${escapeHtml(headline)}</p>` +
        `<p><strong>${escapeHtml(tender.reference)}</strong> — ${escapeHtml(tender.title)}<br>` +
        `${escapeHtml(tender.department)}<br>` +
        `Closes ${escapeHtml(formatDateTime(tender.closingAt))}</p>` +
        blockers +
        `<p><a href="${link}">Open this tender</a></p>` +
        `<p style="color:#666;font-size:12px">${escapeHtml(urgency)}</p>`,
      text:
        `${headline}\n\n${tender.reference} - ${tender.title}\n` +
        `${tender.department}\nCloses ${formatDateTime(tender.closingAt)}\n\n` +
        `${blockersText}\n\n${link}\n\n${urgency}`,
    };
  };

  /* Compulsory briefing — missing it disqualifies the bid outright, so this
     goes out earlier than the closing warnings and regardless of readiness. */
  if (
    tender.briefingCompulsory &&
    !tender.briefingAttended &&
    tender.briefingAt &&
    !alreadySent.has("briefing")
  ) {
    const hours = hoursUntil(tender.briefingAt, now);
    if (hours > 0 && hours <= 72) {
      const content = body(
        `A compulsory briefing for this tender is on ${formatDateTime(tender.briefingAt)}. Missing it disqualifies the bid, whatever else is in order.`,
        "Mark it attended on the tender page once you have been."
      );
      out.push({
        tenderId: tender.id,
        kind: "briefing",
        subject: `Compulsory briefing ${formatDateTime(tender.briefingAt)} — ${tender.reference}`,
        ...content,
      });
    }
  }

  const hoursLeft = hoursUntil(tender.closingAt, now);
  if (hoursLeft <= 0) return out;

  // Whole days left, for the wording. The thresholds below are "at or past",
  // so a step fires on the first run inside its window rather than exactly on
  // it — a bid caught at 171 hours is on the ten-day step but must not be told
  // it "closes in ten days", which it plainly does not.
  const daysLeft = Math.max(1, Math.round(hoursLeft / 24));

  // Most urgent first, and only one closing reminder per run: sending the
  // 7-day and 48-hour warnings in the same batch would be noise.
  const steps: Array<[ReminderKind, number, string, string]> = [
    ["closing_24h", 24, "closes in under 24 hours", "Last chance to deliver it."],
    ["closing_48h", 48, "closes in under 48 hours", "Allow travel time for a physical drop-off."],
    [
      "closing_7d",
      168,
      `closes in ${daysLeft} days`,
      "Time to chase anything still outstanding.",
    ],
    [
      "closing_10d",
      240,
      `closes in ${daysLeft} days`,
      "Early warning — still time to order a rates clearance or chase a signature.",
    ],
  ];

  // Only the most urgent applicable step, and never fall back to a gentler one.
  // Skipping an already-sent step and continuing would mean a bid 20 hours out,
  // whose 24-hour warning had gone, then receiving the 48-hour warning — an
  // escalation running backwards, which reads as a system that has lost track.
  const step = steps.find(([, threshold]) => hoursLeft <= threshold);
  if (step && !alreadySent.has(step[0])) {
    const [kind, , phrase, urgency] = step;
    const content = body(`${tender.reference} ${phrase}.`, urgency);
    out.push({
      tenderId: tender.id,
      kind,
      subject: `${tender.reference} ${phrase} — ${tender.title.slice(0, 60)}`,
      ...content,
    });
  }

  return out;
}
