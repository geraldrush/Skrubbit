import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getCompanyProfile } from "@/lib/company";
import { requireCron } from "@/lib/cron-auth";
import { emailConfigured, parseRecipients, sendEmail } from "@/lib/notify";
import { dueReminders, type ReminderKind } from "@/lib/reminders";
import {
  buildDigest,
  markAnnounced,
  parseProvinces,
  unannouncedAdverts,
} from "@/lib/tender-alerts";
import { itemsByTender, listDocuments, listTenders } from "@/lib/tenders";

export const dynamic = "force-dynamic";

/**
 * The daily notification pass, called by the cron worker.
 *
 * Two jobs, one run and one recipient lookup: deadline reminders for tenders
 * already in the register, then a digest of adverts newly published in the
 * provinces being watched. Both go to the same address and neither is worth a
 * schedule of its own.
 */

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = requireCron(req, env as { CRON_SECRET?: string });
  if (denied) return denied;

  const profile = await getCompanyProfile();
  const recipients = parseRecipients(profile.notifyEmail || profile.email);
  // Kept as a string for the ledgers, which record who a warning went to.
  const recipient = recipients.join(", ");
  if (!recipients.length) {
    return Response.json(
      { ok: true, skipped: "No notification address set under Company details." },
      { status: 200 }
    );
  }
  if (!emailConfigured(env)) {
    return Response.json(
      { ok: true, skipped: "Email provider not configured." },
      { status: 200 }
    );
  }

  const [tenders, itemMap, documents] = await Promise.all([
    listTenders(),
    itemsByTender(),
    listDocuments(),
  ]);

  // One query for every reminder already sent, rather than one per tender.
  const { results: sentRows } = await env.DB.prepare(
    "SELECT tender_id, kind FROM tender_reminders"
  ).all<{ tender_id: number; kind: string }>();

  const sentByTender = new Map<number, Set<ReminderKind>>();
  for (const row of sentRows) {
    const set = sentByTender.get(row.tender_id) ?? new Set<ReminderKind>();
    set.add(row.kind as ReminderKind);
    sentByTender.set(row.tender_id, set);
  }

  const baseUrl = new URL(req.url).origin;
  const now = new Date();
  let sent = 0;
  let failed = 0;

  for (const tender of tenders) {
    const due = dueReminders(
      tender,
      itemMap.get(tender.id) ?? [],
      documents,
      sentByTender.get(tender.id) ?? new Set(),
      baseUrl,
      now
    );

    for (const reminder of due) {
      const result = await sendEmail(env, {
        to: recipients,
        subject: reminder.subject,
        html: reminder.html,
        text: reminder.text,
      });

      // Recorded either way. A failure that is not written down would be
      // retried every day forever, or worse, silently forgotten.
      await env.DB.prepare(
        `INSERT INTO tender_reminders (tender_id, kind, recipient, ok, detail)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tender_id, kind) DO UPDATE SET
           sent_at = datetime('now'), ok = excluded.ok, detail = excluded.detail`
      )
        .bind(
          reminder.tenderId,
          reminder.kind,
          recipient,
          result.ok ? 1 : 0,
          result.detail
        )
        .run();

      if (result.ok) sent++;
      else {
        failed++;
        console.error("[reminders] send failed", reminder.kind, result.detail);
      }
    }
  }

  /* ---------------------- new adverts worth knowing about ---------------- */

  const provinces = parseProvinces(profile.alertProvinces);
  let announced = 0;

  if (provinces.length) {
    const adverts = await unannouncedAdverts(provinces, now);
    const digest = buildDigest(adverts, provinces, baseUrl, now);

    if (digest) {
      const result = await sendEmail(env, {
        to: recipients,
        subject: digest.subject,
        html: digest.html,
        text: digest.text,
      });

      // Marked either way, for the same reason the reminders are: an advert
      // whose email failed and was not written down is re-announced every
      // morning until it drops out of the window.
      await markAnnounced(digest.ocids, recipient, result.ok, result.detail);

      if (result.ok) announced = digest.ocids.length;
      else {
        failed++;
        console.error("[alerts] digest failed", result.detail);
      }
    }
  }

  return Response.json({
    ok: true,
    sent,
    failed,
    checked: tenders.length,
    announced,
    watching: provinces,
  });
}
