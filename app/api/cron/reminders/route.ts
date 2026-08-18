import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getCompanyProfile } from "@/lib/company";
import { emailConfigured, sendEmail } from "@/lib/notify";
import { dueReminders, type ReminderKind } from "@/lib/reminders";
import { itemsByTender, listDocuments, listTenders } from "@/lib/tenders";

export const dynamic = "force-dynamic";

/**
 * Sends deadline reminders. Called daily by the cron worker.
 *
 * Not behind the admin session — a cron has no cookie — so it authenticates on
 * a shared secret instead, compared in constant time. Without CRON_SECRET set
 * the endpoint refuses outright rather than running open, so a missing secret
 * fails closed instead of exposing a send loop to the internet.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const secret = (env as { CRON_SECRET?: string }).CRON_SECRET;

  if (!secret) {
    return Response.json(
      { error: "Reminders are not configured (CRON_SECRET unset)." },
      { status: 503 }
    );
  }

  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-cron-secret") ??
    "";
  if (!timingSafeEqual(supplied, secret)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await getCompanyProfile();
  const recipient = profile.notifyEmail || profile.email;
  if (!recipient) {
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
        to: recipient,
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

  return Response.json({ ok: true, sent, failed, checked: tenders.length });
}
