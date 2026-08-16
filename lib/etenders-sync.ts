/**
 * Background crawl of the eTenders feed into D1.
 *
 * The feed cannot be paged the usual way. It returns short, variable-length
 * pages against any requested page size, so the only reliable end-of-data
 * signal is a page with zero records — treating a short page as the last one
 * stops the crawl almost immediately.
 *
 * It is also slow (tens of seconds per page, frequent timeouts, and it starts
 * refusing requests when pages are fetched in parallel), which is why pages are
 * fetched strictly one at a time, a run is bounded, and progress is stored as a
 * resumable cursor rather than attempted in a single pass.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { ocdsToSast } from "@/lib/etenders";

const BASE = "https://ocds-api.etenders.gov.za/api/OCDSReleases";

/** Pages per run. Two, because a single page has been measured at 75s — a
 *  longer run risks being cut off before it can record its progress. */
const PAGES_PER_RUN = 2;
/** Attempts at one page before giving up on it and moving past. */
const MAX_PAGE_ATTEMPTS = 3;
const PAGE_SIZE = 100;
/** The feed is genuinely this slow: pages have been measured at 43s and 75s.
 *  A tighter timeout doesn't make it faster, it just loses the page. */
const PAGE_TIMEOUT_MS = 100_000;
/** How far back to ask for adverts. Open tenders can have been advertised
 *  months ago, and filtering to "still open" happens on closing date instead. */
const WINDOW_DAYS = 365;
/** A run that started longer ago than this is assumed dead. */
const STALE_RUN_MS = 10 * 60 * 1000;

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

export interface SyncState {
  nextPage: number;
  pageAttempts: number;
  running: boolean;
  lastRunAt: string | null;
  lastSweepAt: string | null;
  pagesLastRun: number;
  recordsTotal: number;
  status: string;
  message: string;
}

interface StateRow {
  next_page: number;
  page_attempts: number;
  running: number;
  started_at: string | null;
  last_run_at: string | null;
  last_sweep_at: string | null;
  pages_last_run: number;
  records_total: number;
  status: string;
  message: string;
}

export async function getSyncState(): Promise<SyncState> {
  const row = await db()
    .prepare("SELECT * FROM sync_state WHERE id = 1")
    .first<StateRow>();

  return {
    nextPage: row?.next_page ?? 1,
    pageAttempts: row?.page_attempts ?? 0,
    running: row?.running === 1,
    lastRunAt: row?.last_run_at ?? null,
    lastSweepAt: row?.last_sweep_at ?? null,
    pagesLastRun: row?.pages_last_run ?? 0,
    recordsTotal: row?.records_total ?? 0,
    status: row?.status ?? "never",
    message: row?.message ?? "",
  };
}

/**
 * Whether a fresh run should be started now.
 *
 * Catch-up mode: until a full sweep has ever completed, the mirror is
 * incomplete and worth topping up on almost every visit. Only a page or two
 * lands per run against a feed this slow, so waiting hours between runs would
 * leave the mirror partial for days. Once a sweep completes it backs off, since
 * from then on the crawl is only refreshing what it already holds.
 */
export async function syncIsDue(): Promise<boolean> {
  const row = await db()
    .prepare("SELECT * FROM sync_state WHERE id = 1")
    .first<StateRow>();
  if (!row) return true;

  if (row.running === 1) {
    // Unless the previous run died without clearing the flag.
    const started = row.started_at ? Date.parse(`${row.started_at.replace(" ", "T")}Z`) : 0;
    if (Date.now() - started < STALE_RUN_MS) return false;
  }

  if (!row.last_run_at) return true;
  const maxAgeMinutes = row.last_sweep_at ? 180 : 3;
  const last = Date.parse(`${row.last_run_at.replace(" ", "T")}Z`);
  return Number.isNaN(last) || Date.now() - last > maxAgeMinutes * 60_000;
}

interface RawRelease {
  ocid?: string;
  buyer?: { name?: string };
  tender?: Record<string, unknown>;
}

async function fetchPage(page: number): Promise<RawRelease[] | null> {
  const from = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const url = `${BASE}?PageNumber=${page}&PageSize=${PAGE_SIZE}&dateFrom=${from}&dateTo=${to}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { accept: "application/json" },
      // The mirror is the cache; caching the upstream too would only serve
      // this crawl stale pages.
      cf: { cacheTtl: 0 },
    } as RequestInit);
    if (!res.ok) return null;
    const body = (await res.json()) as { releases?: RawRelease[] };
    return body.releases ?? [];
  } catch {
    // Timeout or transport failure — indistinguishable from the feed being
    // busy. The caller retries this same page on the next run rather than
    // moving past it, so a slow page doesn't silently lose its tenders.
    return null;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

interface Mapped {
  ocid: string;
  reference: string;
  title: string;
  description: string;
  department: string;
  closingAt: string | null;
  briefingAt: string | null;
  briefingCompulsory: number;
  briefingVenue: string;
  province: string;
  category: string;
  deliveryLocation: string;
  valueAmount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  documentUrl: string;
  searchText: string;
}

function map(release: RawRelease): Mapped | null {
  const ocid = str(release.ocid);
  const t = release.tender as Record<string, any> | undefined;
  if (!ocid || !t) return null;

  const briefing = t.briefingSession as Record<string, any> | undefined;
  const isSession = Boolean(briefing?.isSession);
  // OCDS puts the tender number in `title` and the subject in `description`,
  // which is the opposite of what those names suggest.
  const title = str(t.description) || str(t.title);
  const department = str(release.buyer?.name) || str(t.procuringEntity?.name);
  const reference = str(t.title) || str(t.id);

  return {
    ocid,
    reference,
    title,
    description: str(t.description),
    department,
    closingAt: ocdsToSast(t.tenderPeriod?.endDate),
    briefingAt: isSession ? ocdsToSast(briefing?.date) : null,
    briefingCompulsory: isSession && briefing?.compulsory ? 1 : 0,
    briefingVenue: isSession ? str(briefing?.venue) : "",
    province: str(t.province),
    category: str(t.mainProcurementCategory),
    deliveryLocation: str(t.deliveryLocation),
    valueAmount: typeof t.value?.amount === "number" ? t.value.amount : 0,
    contactName: str(t.contactPerson?.name),
    contactEmail: str(t.contactPerson?.email),
    contactPhone: str(t.contactPerson?.telephoneNumber),
    documentUrl: Array.isArray(t.documents) ? str(t.documents[0]?.url) : "",
    searchText: `${title} ${reference} ${department} ${str(t.deliveryLocation)}`.toLowerCase(),
  };
}

async function upsert(rows: Mapped[]): Promise<void> {
  if (!rows.length) return;
  const d = db();
  await d.batch(
    rows.map((r) =>
      d
        .prepare(
          `INSERT INTO remote_tenders
             (ocid, reference, title, description, department, closing_at,
              briefing_at, briefing_compulsory, briefing_venue, province,
              category, delivery_location, value_amount, contact_name,
              contact_email, contact_phone, document_url, search_text, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(ocid) DO UPDATE SET
             reference = excluded.reference,
             title = excluded.title,
             description = excluded.description,
             department = excluded.department,
             closing_at = excluded.closing_at,
             briefing_at = excluded.briefing_at,
             briefing_compulsory = excluded.briefing_compulsory,
             briefing_venue = excluded.briefing_venue,
             province = excluded.province,
             category = excluded.category,
             delivery_location = excluded.delivery_location,
             value_amount = excluded.value_amount,
             contact_name = excluded.contact_name,
             contact_email = excluded.contact_email,
             contact_phone = excluded.contact_phone,
             document_url = excluded.document_url,
             search_text = excluded.search_text,
             synced_at = datetime('now')`
        )
        .bind(
          r.ocid, r.reference, r.title, r.description, r.department, r.closingAt,
          r.briefingAt, r.briefingCompulsory, r.briefingVenue, r.province,
          r.category, r.deliveryLocation, r.valueAmount, r.contactName,
          r.contactEmail, r.contactPhone, r.documentUrl, r.searchText
        )
    )
  );
}

/**
 * Runs one bounded batch of the crawl.
 *
 * Safe to call repeatedly: it claims the run flag first, so two overlapping
 * triggers don't both crawl. Returns a short summary for logging.
 */
export async function runSyncBatch(): Promise<{
  pages: number;
  records: number;
  sweepComplete: boolean;
}> {
  const d = db();

  // Claim the run. The started_at guard lets a crashed run be taken over.
  const claimed = await d
    .prepare(
      `UPDATE sync_state
          SET running = 1, started_at = datetime('now')
        WHERE id = 1
          AND (running = 0
               OR started_at IS NULL
               OR started_at < datetime('now', '-10 minutes'))`
    )
    .run();
  if (!claimed.meta.changes) {
    return { pages: 0, records: 0, sweepComplete: false };
  }

  const state = await getSyncState();
  let page = state.nextPage > 0 ? state.nextPage : 1;
  let attempts = state.pageAttempts;
  let pages = 0;
  let records = 0;
  let sweepComplete = false;
  let skipped = 0;
  let timedOut = 0;

  try {
    for (let i = 0; i < PAGES_PER_RUN; i++) {
      const releases = await fetchPage(page);

      if (releases === null) {
        // The feed times out constantly, so a failed page is retried on the
        // next run rather than skipped — skipping silently loses a whole page
        // of tenders, which is the bug this crawl exists to fix. A page that
        // keeps failing is stepped over so one bad page can't wedge the crawl.
        timedOut++;
        attempts++;
        if (attempts >= MAX_PAGE_ATTEMPTS) {
          page++;
          attempts = 0;
          skipped++;
        }
        break; // Back off for this run; the feed is clearly struggling.
      }

      attempts = 0;
      pages++;

      if (releases.length === 0) {
        // The only trustworthy end-of-data signal this feed gives: short pages
        // are normal, so only an empty one means the end.
        sweepComplete = true;
        page = 1;
        break;
      }

      const mapped = releases
        .map(map)
        .filter((m): m is Mapped => m !== null && Boolean(m.closingAt));
      await upsert(mapped);
      records += mapped.length;
      page++;
    }

    // Drop anything that closed over a month ago; the register keeps whatever
    // was imported, so nothing of value is lost here.
    await d
      .prepare(
        "DELETE FROM remote_tenders WHERE closing_at IS NOT NULL AND closing_at < datetime('now', '-30 days')"
      )
      .run();

    const total = await d
      .prepare("SELECT COUNT(*) AS n FROM remote_tenders")
      .first<{ n: number }>();

    await d
      .prepare(
        `UPDATE sync_state SET
           running = 0,
           next_page = ?,
           page_attempts = ?,
           last_run_at = datetime('now'),
           last_sweep_at = CASE WHEN ? = 1 THEN datetime('now') ELSE last_sweep_at END,
           pages_last_run = ?,
           records_total = ?,
           status = ?,
           message = ?
         WHERE id = 1`
      )
      .bind(
        page,
        attempts,
        sweepComplete ? 1 : 0,
        pages,
        total?.n ?? 0,
        pages ? "ok" : "slow",
        timedOut
          ? skipped
            ? `Page ${page - 1} failed ${MAX_PAGE_ATTEMPTS} times and was skipped.`
            : `The feed timed out on page ${page}; it will be retried.`
          : ""
      )
      .run();
  } catch (err) {
    await d
      .prepare(
        `UPDATE sync_state
            SET running = 0, last_run_at = datetime('now'), status = 'failed', message = ?
          WHERE id = 1`
      )
      .bind(String(err).slice(0, 300))
      .run();
    throw err;
  }

  return { pages, records, sweepComplete };
}
