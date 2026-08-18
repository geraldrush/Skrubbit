/**
 * Alerts for newly advertised tenders in the provinces being watched.
 *
 * The deadline reminders in lib/reminders.ts warn about bids already in the
 * register. This is the other half: telling you an advert exists at all, while
 * there is still time to bid on it.
 *
 * One digest rather than one email per tender — a morning listing five new
 * Limpopo adverts gets read; five separate emails get filtered.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { NEW_FOR_DAYS } from "@/lib/local-sources";
import { formatDateTime } from "@/lib/tenders";

/** How far back an advert can be and still count as new. Wider than the daily
 *  cadence so a failed run doesn't silently skip a day's tenders — the sent
 *  ledger, not the window, is what stops repeats. */
const WINDOW_DAYS = 4;

/** Most tenders listed in one digest. A morning with more than this is a feed
 *  glitch or a first run after a gap; the rest are still marked as announced,
 *  because the search page is the right place to work through a backlog. */
const MAX_LISTED = 25;

export interface NewAdvert {
  ocid: string;
  reference: string;
  title: string;
  department: string;
  province: string;
  category: string;
  closingAt: string | null;
  publishedAt: string | null;
  documentUrl: string;
}

interface Row {
  ocid: string;
  reference: string;
  title: string;
  department: string;
  province: string;
  category: string;
  closing_at: string | null;
  published_at: string | null;
  document_url: string;
}

/** "Limpopo, Gauteng" as stored on the profile → the provinces to match. */
export function parseProvinces(value: string): string[] {
  return value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    // The feed spells provinces exactly one way, so a cap keeps a malformed
    // setting from turning into a query with hundreds of bound parameters.
    .slice(0, 12);
}

/**
 * Adverts in those provinces that are new, still open, and not yet announced.
 *
 * "New" is by advert date, not by when the mirror first saw the row. The crawl
 * is resumable and can reach a page weeks late; dating by first sight would
 * announce that backlog as though it had just been published.
 */
export async function unannouncedAdverts(
  provinces: string[],
  now: Date = new Date()
): Promise<NewAdvert[]> {
  if (!provinces.length) return [];
  const d = getCloudflareContext().env.DB;

  const placeholders = provinces.map(() => "?").join(", ");
  const since = new Date(now.getTime() - WINDOW_DAYS * 864e5).toISOString();
  const seenSince = new Date(now.getTime() - NEW_FOR_DAYS * 864e5).toISOString();
  const nowIso = now.toISOString();

  const cols = `ocid, reference, title, department, province, category,
                closing_at, published_at, document_url`;

  // Nothing already in the register: being told about a tender you are already
  // preparing a bid for is noise, and the deadline reminders have it covered.
  const notAlready = `ocid NOT IN (SELECT ocid FROM remote_tender_alerts)
          AND ocid NOT IN (SELECT ocid FROM tenders WHERE ocid IS NOT NULL)`;

  // Two rules, because the two kinds of source know different things.
  //
  // Portal adverts are dated by their OCDS release date and always carry a
  // closing date, so "new" means recently advertised and still open.
  //
  // Scraped notices usually carry neither — a municipal RFQ is a PDF link on a
  // page — so "new" means we had not seen it yesterday. That is only honest
  // because the whole listing page is re-read every run, unlike the portal
  // crawl, which can reach a page weeks late.
  const [portal, local] = await Promise.all([
    d
      .prepare(
        `SELECT ${cols} FROM remote_tenders
          WHERE source = 'etenders'
            AND province IN (${placeholders})
            AND published_at IS NOT NULL
            AND published_at >= ?
            AND closing_at IS NOT NULL
            AND closing_at > ?
            AND ${notAlready}
          ORDER BY published_at DESC, closing_at ASC`
      )
      .bind(...provinces, since, nowIso)
      .all<Row>(),
    d
      .prepare(
        `SELECT ${cols} FROM remote_tenders
          WHERE source <> 'etenders'
            -- Province still applies: unticking Limpopo must silence the local
            -- scrapers too, not just the portal.
            AND province IN (${placeholders})
            AND first_seen_at IS NOT NULL
            AND first_seen_at >= ?
            AND (closing_at IS NULL OR closing_at > ?)
            AND ${notAlready}
          ORDER BY first_seen_at DESC`
      )
      .bind(...provinces, seenSince, nowIso)
      .all<Row>(),
  ]);

  // Local sources are listed first: they are the ones nobody else will tell
  // you about, and they are on the doorstep.
  const results = [...local.results, ...portal.results];

  return results.map((r) => ({
    ocid: r.ocid,
    reference: r.reference,
    title: r.title,
    department: r.department,
    province: r.province,
    category: r.category,
    closingAt: r.closing_at,
    publishedAt: r.published_at,
    documentUrl: r.document_url,
  }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const daysUntil = (iso: string, now: Date) =>
  Math.ceil((new Date(iso).getTime() - now.getTime()) / 864e5);

export interface Digest {
  subject: string;
  html: string;
  text: string;
  /** Every advert covered, including any past MAX_LISTED — all of them are
   *  recorded as announced, so the ledger matches what the email claimed. */
  ocids: string[];
}

/** Builds the digest email. Pure, so the wording can be checked without a
 *  database or a mail provider. */
export function buildDigest(
  adverts: NewAdvert[],
  provinces: string[],
  baseUrl: string,
  now: Date = new Date()
): Digest | null {
  if (!adverts.length) return null;

  const listed = adverts.slice(0, MAX_LISTED);
  const overflow = adverts.length - listed.length;
  const where = provinces.join(", ");
  const searchLink = `${baseUrl}/admin/tenders/search`;

  const heading =
    adverts.length === 1
      ? `One new ${where} tender has been advertised.`
      : `${adverts.length} new ${where} tenders have been advertised.`;

  const rows = listed.map((a) => {
    const closing = a.closingAt
      ? `Closes ${formatDateTime(a.closingAt)} (${daysUntil(a.closingAt, now)} days)`
      : "No closing date given";
    return {
      html:
        `<div style="margin:0 0 18px;padding:0 0 18px;border-bottom:1px solid #eee">` +
        `<strong>${escapeHtml(a.reference || a.ocid)}</strong><br>` +
        `${escapeHtml(a.title)}<br>` +
        `<span style="color:#555">${escapeHtml(a.department)}</span><br>` +
        `<span style="color:#555">${escapeHtml(closing)}</span>` +
        (a.documentUrl
          ? `<br><a href="${escapeHtml(a.documentUrl)}">Tender document</a>`
          : "") +
        `</div>`,
      text:
        `${a.reference || a.ocid}\n${a.title}\n${a.department}\n${closing}` +
        (a.documentUrl ? `\n${a.documentUrl}` : ""),
    };
  });

  const more = overflow
    ? `${overflow} further advert${overflow === 1 ? "" : "s"} not listed — see the search page.`
    : "";

  return {
    subject:
      adverts.length === 1
        ? `New ${where} tender: ${listed[0].title.slice(0, 70)}`
        : `${adverts.length} new ${where} tenders`,
    html:
      `<p>${escapeHtml(heading)}</p>` +
      rows.map((r) => r.html).join("") +
      (more ? `<p>${escapeHtml(more)}</p>` : "") +
      `<p><a href="${searchLink}">Open the tender search</a> to import any of these into the register.</p>` +
      `<p style="color:#666;font-size:12px">Closing times come from the eTenders feed. Confirm them against the tender document before relying on them.</p>`,
    text:
      `${heading}\n\n` +
      rows.map((r) => r.text).join("\n\n") +
      (more ? `\n\n${more}` : "") +
      `\n\n${searchLink}\n\n` +
      `Closing times come from the eTenders feed. Confirm them against the tender document before relying on them.`,
    ocids: adverts.map((a) => a.ocid),
  };
}

/**
 * Records adverts as announced.
 *
 * Written whether or not the email got through, and for every advert the
 * digest covered rather than only the listed ones. A failure that isn't
 * written down is re-announced every morning until the window slides past it.
 */
export async function markAnnounced(
  ocids: string[],
  recipient: string,
  ok: boolean,
  detail: string
): Promise<void> {
  if (!ocids.length) return;
  const d = getCloudflareContext().env.DB;
  await d.batch(
    ocids.map((ocid) =>
      d
        .prepare(
          `INSERT INTO remote_tender_alerts (ocid, recipient, ok, detail)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(ocid) DO UPDATE SET
             sent_at = datetime('now'), ok = excluded.ok, detail = excluded.detail`
        )
        .bind(ocid, recipient, ok ? 1 : 0, detail)
    )
  );
}
