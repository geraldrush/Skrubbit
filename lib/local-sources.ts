/**
 * Buyers who advertise on their own website instead of the national portal.
 *
 * The eTenders feed carries tenders; it does not carry quotations. Anything
 * under the bid threshold is advertised on the buyer's own site and sent to
 * suppliers on its database, which is where most of the work a small supplier
 * can actually win lives. Vhembe TVET College advertises three-year contracts
 * for cleaning materials and for stationery and appears nowhere in the portal
 * mirror at all.
 *
 * Each source is a listing page of PDF links. That is all the structure these
 * sites have — no feed, no API, and in most cases no closing date in the HTML —
 * so a notice is identified by its document URL and dated by when we first saw
 * it. Rows land in `remote_tenders` alongside the portal's, tagged with
 * `source`, so search, the digest and importing all work on them unchanged.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface LocalSource {
  /** Stable id, used as the ocid prefix. Never change one in place. */
  id: string;
  /** Buyer name, as it should read in the register and the digest. */
  department: string;
  province: string;
  /** Listing pages to read. */
  urls: string[];
  /**
   * Only links matching this are notices; the rest of the page is navigation,
   * annual reports and policy documents.
   */
  match: RegExp;
}

/**
 * Vhembe TVET College publishes over HTTP on purpose here.
 *
 * Its certificate has expired — not a missing intermediate, an expired leaf —
 * so every TLS client refuses it, `fetch` in a Worker included, and there is no
 * way to waive that from inside a Worker. Plain HTTP answers 200 with no
 * redirect. The page is public procurement notices with nothing secret in the
 * request, so reading it unencrypted costs nothing; if the college ever renews,
 * the https attempt below starts succeeding on its own.
 */
export const LOCAL_SOURCES: LocalSource[] = [
  {
    id: "vtvet",
    department: "Vhembe TVET College",
    province: "Limpopo",
    urls: ["https://www.vhembecollege.edu.za/procurement/"],
    match: /\.pdf$/i,
  },
  {
    id: "musina",
    department: "Musina Local Municipality",
    province: "Limpopo",
    // Only the first listing page: it is ordered newest first and 22 pages deep,
    // and everything behind page one is closed long ago.
    urls: ["https://www.musina.gov.za/tenders/request-for-quotations/"],
    match: /\/wp-content\/uploads\/.+\.pdf$/i,
  },
];

/** Notices first seen within this many days are new enough to announce. */
const NEW_FOR_DAYS = 4;

/**
 * On a source's first run, anything that looks older than this is recorded as
 * already announced rather than emailed. Without it, adding a source means one
 * email listing years of closed adverts — 277 documents, in the college's case.
 */
const BACKFILL_DAYS = 60;

export interface Notice {
  ocid: string;
  title: string;
  documentUrl: string;
  /** From the upload path where the site exposes one, e.g. /uploads/2026/08/. */
  publishedAt: string | null;
}

/* ------------------------------ fetching -------------------------------- */

/**
 * Reads a listing page, falling back to HTTP when TLS fails.
 *
 * Deliberately not silent about which one worked — a site whose certificate is
 * fixed should stop needing the fallback, and a site that starts needing it has
 * had something break worth knowing about.
 */
async function readPage(url: string): Promise<{ html: string; insecure: boolean } | null> {
  const attempt = async (target: string) => {
    const res = await fetch(target, {
      headers: { accept: "text/html", "user-agent": "SkrubbitTenderWatch/1.0" },
      signal: AbortSignal.timeout(30_000),
      cf: { cacheTtl: 0 },
    } as RequestInit);
    return res.ok ? await res.text() : null;
  };

  try {
    const html = await attempt(url);
    if (html) return { html, insecure: false };
  } catch {
    // Falls through to HTTP: an expired or unverifiable certificate throws here
    // rather than returning a status, and cannot be waived from a Worker.
  }

  if (url.startsWith("https://")) {
    try {
      const html = await attempt(`http://${url.slice("https://".length)}`);
      if (html) return { html, insecure: true };
    } catch {
      /* Genuinely unreachable. */
    }
  }
  return null;
}

/* ------------------------------- parsing -------------------------------- */

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

/** FNV-1a over the document URL. Only needs to be stable and collision-free
 *  enough to key a few hundred notices — truncating a long filename to build
 *  the id risks two adverts sharing one. */
function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** A document URL turned into a readable title, for the sites that give no
 *  usable link text. `OPENING-VTVET-03-2024-CLEANING.pdf` reads as words. */
function titleFromUrl(url: string): string {
  const file = url.split("/").pop() ?? url;
  return decodeURIComponent(file)
    .replace(/\.pdf$/i, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\d{10,}\b/g, "") // WordPress timestamp suffixes
    .trim();
}

/** WordPress stores uploads under /YYYY/MM/, which is the only date most of
 *  these notices carry. Day 01, since the path has no finer resolution. */
function publishedFromUrl(url: string): string | null {
  const m = /\/(20\d{2})\/(0[1-9]|1[0-2])\//.exec(url);
  return m ? `${m[1]}-${m[2]}-01T00:00:00+02:00` : null;
}

export function parseNotices(html: string, source: LocalSource, pageUrl: string): Notice[] {
  const base = new URL(pageUrl);
  const out = new Map<string, Notice>();

  const anchor = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
  for (let m = anchor.exec(html); m; m = anchor.exec(html)) {
    let href: string;
    try {
      href = new URL(decode(m[1]), base).toString();
    } catch {
      continue;
    }
    if (!source.match.test(href.split("?")[0])) continue;

    // Link text where the site gives one, filename where it does not. Both
    // sites wrap the text in markup, so tags come out first.
    const text = decode(m[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .replace(/\(pdf\)$/i, "")
      // The download-manager plugins prefix the link text with their button
      // label, which is not part of the advert's name.
      .replace(/^(?:download|view|open)\s+/i, "")
      .trim();
    const title = text.length > 8 ? text : titleFromUrl(href);

    // Keyed by document URL: the same notice is often linked twice on a page,
    // once as an icon and once as text.
    if (!out.has(href)) {
      out.set(href, {
        ocid: `${source.id}:${hash(href)}`,
        title: title.slice(0, 300),
        documentUrl: href,
        publishedAt: publishedFromUrl(href),
      });
    }
  }

  return [...out.values()];
}

/* ------------------------------- storing -------------------------------- */

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

async function store(source: LocalSource, notices: Notice[]): Promise<number> {
  if (!notices.length) return 0;
  const d = db();

  await d.batch(
    notices.map((n) =>
      d
        .prepare(
          `INSERT INTO remote_tenders
             (ocid, reference, title, description, department, province,
              document_url, published_at, search_text, source, first_seen_at, synced_at)
           VALUES (?, '', ?, '', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(ocid) DO UPDATE SET
             title = excluded.title,
             document_url = excluded.document_url,
             published_at = COALESCE(excluded.published_at, published_at),
             search_text = excluded.search_text,
             -- first_seen_at is never touched again: it is what makes a notice
             -- new exactly once, and re-reading the page every day must not
             -- keep resetting it.
             synced_at = datetime('now')`
        )
        .bind(
          n.ocid,
          n.title,
          source.department,
          source.province,
          n.documentUrl,
          n.publishedAt,
          `${n.title} ${source.department}`.toLowerCase(),
          source.id
        )
    )
  );

  return notices.length;
}

/**
 * Records a source's history as already announced, the first time it runs.
 *
 * Only the backlog: anything recent enough to plausibly still be open is left
 * for the digest to announce normally, so adding a source produces a useful
 * first email rather than either silence or a dump of every notice it has ever
 * published.
 */
async function backfillIfFirstRun(source: LocalSource): Promise<number> {
  const d = db();
  const seen = await d
    .prepare("SELECT COUNT(*) AS n FROM remote_tender_alerts WHERE ocid LIKE ?")
    .bind(`${source.id}:%`)
    .first<{ n: number }>();
  if ((seen?.n ?? 0) > 0) return 0;

  const cutoff = new Date(Date.now() - BACKFILL_DAYS * 864e5).toISOString();
  const res = await d
    .prepare(
      `INSERT OR IGNORE INTO remote_tender_alerts (ocid, recipient, ok, detail)
       SELECT ocid, '', 1, 'backfilled on first run'
         FROM remote_tenders
        WHERE source = ?
          AND (published_at IS NULL OR published_at < ?)`
    )
    .bind(source.id, cutoff)
    .run();
  return res.meta.changes ?? 0;
}

export interface LocalSyncResult {
  source: string;
  notices: number;
  backfilled: number;
  insecure: boolean;
  error?: string;
}

/** Reads every local source. One failing site must not stop the others. */
export async function syncLocalSources(): Promise<LocalSyncResult[]> {
  const results: LocalSyncResult[] = [];

  for (const source of LOCAL_SOURCES) {
    let notices = 0;
    let insecure = false;
    let error: string | undefined;

    for (const url of source.urls) {
      try {
        const page = await readPage(url);
        if (!page) {
          error = "unreachable";
          continue;
        }
        insecure = insecure || page.insecure;
        notices += await store(source, parseNotices(page.html, source, url));
      } catch (err) {
        error = String(err).slice(0, 200);
      }
    }

    const backfilled = notices ? await backfillIfFirstRun(source) : 0;
    results.push({ source: source.id, notices, backfilled, insecure, error });
  }

  return results;
}

export { NEW_FOR_DAYS };
