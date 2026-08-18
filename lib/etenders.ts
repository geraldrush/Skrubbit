/**
 * Reading the mirrored National Treasury eTenders feed.
 *
 * Source: https://ocds-api.etenders.gov.za — the official publication of South
 * African public procurement, under a public-domain dedication (PDDL). Using it
 * rather than scraping etenders.gov.za means a stable contract, no terms
 * problem, and fields we can trust rather than parsed HTML.
 *
 * Fetching and crawling live here in lib/etenders-sync.ts; this module only
 * reads the local copy, plus the timestamp correction both sides depend on.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

/* ------------------------- the timestamp problem ------------------------- */

/**
 * Reinterprets an OCDS timestamp as South African local time.
 *
 * The feed stamps every date with `Z`, but the values are plainly local
 * wall-clock times: across a sample of 85 live releases, closing times cluster
 * on 11:00 (43), 12:00 (27) and 10:00 (8) — the standard South African tender
 * box hours. Real UTC would put that cluster on 09:00Z.
 *
 * Taking them literally as UTC would render every deadline two hours LATE,
 * which is the single worst error this system could make: the guide is blunt
 * that one minute late is a rejection. So the clock reading is preserved and
 * the offset corrected to +02:00.
 *
 * Imported deadlines should still be checked against the tender document —
 * the source URL is kept on every imported tender for exactly that reason.
 */
export function ocdsToSast(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, min] = m;
  // The API's "no value" sentinel for optional dates.
  if (y === "0001") return null;
  return `${y}-${mo}-${d}T${h}:${min}:00+02:00`;
}

/* -------------------------------- types --------------------------------- */

export interface RemoteDocument {
  title: string;
  url: string;
}

export interface RemoteTender {
  ocid: string;
  /** The advertised tender number, e.g. "43G/2026/27". */
  reference: string;
  title: string;
  description: string;
  department: string;
  closingAt: string | null;
  /** When it was advertised, from the OCDS release date. */
  publishedAt: string | null;
  briefingAt: string | null;
  briefingCompulsory: boolean;
  briefingVenue: string;
  province: string;
  category: string;
  deliveryLocation: string;
  valueAmount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  documents: RemoteDocument[];
  sourceUrl: string;
}

export interface SearchOptions {
  /** Free text; every word must appear. */
  keyword?: string;
  province?: string;
  /** goods | services | works */
  category?: string;
  limit?: number;
}

export interface SearchResult {
  tenders: RemoteTender[];
  /** How many open tenders match before the limit is applied. */
  matched: number;
  /** How many open tenders are mirrored in total. */
  available: number;
}

interface LocalRow {
  ocid: string;
  reference: string;
  title: string;
  description: string;
  department: string;
  closing_at: string | null;
  published_at: string | null;
  briefing_at: string | null;
  briefing_compulsory: number;
  briefing_venue: string;
  province: string;
  category: string;
  delivery_location: string;
  value_amount: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  document_url: string;
}

function fromRow(r: LocalRow): RemoteTender {
  return {
    ocid: r.ocid,
    reference: r.reference,
    title: r.title,
    description: r.description,
    department: r.department,
    closingAt: r.closing_at,
    publishedAt: r.published_at,
    briefingAt: r.briefing_at,
    briefingCompulsory: r.briefing_compulsory === 1,
    briefingVenue: r.briefing_venue,
    province: r.province,
    category: r.category,
    deliveryLocation: r.delivery_location,
    valueAmount: r.value_amount,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    documents: r.document_url ? [{ title: "Tender document", url: r.document_url }] : [],
    sourceUrl: "https://www.etenders.gov.za/Home/TenderOpportunities/",
  };
}

/**
 * Searches the mirrored feed.
 *
 * "Open" means the closing date has not passed — the same definition
 * etenders.gov.za lists by. It deliberately does not consider when a tender was
 * advertised: one advertised months ago that closes next week is still open and
 * must appear.
 *
 * Runs against D1 rather than the live feed, which is too slow and too
 * unreliable to crawl while someone waits. See lib/etenders-sync.ts.
 */
export async function searchTenders(
  options: SearchOptions = {}
): Promise<SearchResult> {
  const { keyword = "", province = "", category = "", limit = 300 } = options;
  const d = getCloudflareContext().env.DB;

  const where: string[] = ["closing_at IS NOT NULL", "closing_at > ?"];
  const binds: unknown[] = [new Date().toISOString()];

  if (province) {
    where.push("province = ?");
    binds.push(province);
  }
  if (category) {
    where.push("category = ?");
    binds.push(category);
  }
  // Each term is a bound parameter and D1 allows only 100 per query, so the
  // number of terms is capped well below that rather than trusting the input.
  const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  for (const term of terms) {
    // Every word must appear, so extra words narrow rather than widen.
    where.push("search_text LIKE ?");
    binds.push(`%${term}%`);
  }

  const clause = where.join(" AND ");

  const [rows, matched, available] = await Promise.all([
    d
      .prepare(`SELECT * FROM remote_tenders WHERE ${clause} ORDER BY closing_at ASC LIMIT ?`)
      .bind(...binds, limit)
      .all<LocalRow>(),
    d
      .prepare(`SELECT COUNT(*) AS n FROM remote_tenders WHERE ${clause}`)
      .bind(...binds)
      .first<{ n: number }>(),
    d
      .prepare("SELECT COUNT(*) AS n FROM remote_tenders WHERE closing_at > ?")
      .bind(new Date().toISOString())
      .first<{ n: number }>(),
  ]);

  return {
    tenders: rows.results.map(fromRow),
    matched: matched?.n ?? 0,
    available: available?.n ?? 0,
  };
}

/** A single mirrored advert, for import. */
export async function getRemoteTender(ocid: string): Promise<RemoteTender | null> {
  const row = await getCloudflareContext()
    .env.DB.prepare("SELECT * FROM remote_tenders WHERE ocid = ?")
    .bind(ocid)
    .first<LocalRow>();
  return row ? fromRow(row) : null;
}
