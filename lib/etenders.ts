/**
 * Client for the National Treasury eTenders OCDS API.
 *
 * https://ocds-api.etenders.gov.za — the official publication of South African
 * public procurement, released under a public-domain dedication (PDDL). Using
 * it rather than scraping etenders.gov.za means a stable contract, no terms
 * problem, and fields we can trust rather than parsed HTML.
 *
 * The API filters only by release date and page, so keyword, province and
 * category narrowing happens here after fetching.
 */

const BASE = "https://ocds-api.etenders.gov.za/api/OCDSReleases";

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

interface OcdsRelease {
  ocid?: string;
  buyer?: { name?: string };
  tender?: {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    province?: string;
    deliveryLocation?: string;
    mainProcurementCategory?: string;
    value?: { amount?: number };
    tenderPeriod?: { endDate?: string };
    briefingSession?: {
      isSession?: boolean;
      compulsory?: boolean;
      date?: string;
      venue?: string;
    };
    contactPerson?: { name?: string; email?: string; telephoneNumber?: string };
    procuringEntity?: { name?: string };
    documents?: Array<{ title?: string; url?: string }>;
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function normalise(release: OcdsRelease): RemoteTender | null {
  const t = release.tender;
  const ocid = str(release.ocid);
  if (!t || !ocid) return null;

  const briefing = t.briefingSession;
  const briefingAt = briefing?.isSession ? ocdsToSast(briefing.date) : null;

  return {
    ocid,
    reference: str(t.title) || str(t.id),
    // OCDS puts the tender number in `title` and the actual subject in
    // `description`, which is the opposite of what those names suggest.
    title: str(t.description) || str(t.title),
    description: str(t.description),
    department: str(release.buyer?.name) || str(t.procuringEntity?.name),
    closingAt: ocdsToSast(t.tenderPeriod?.endDate),
    briefingAt,
    briefingCompulsory: Boolean(briefing?.isSession && briefing?.compulsory),
    briefingVenue: briefing?.isSession ? str(briefing.venue) : "",
    province: str(t.province),
    category: str(t.mainProcurementCategory),
    deliveryLocation: str(t.deliveryLocation),
    valueAmount: typeof t.value?.amount === "number" ? t.value.amount : 0,
    contactName: str(t.contactPerson?.name),
    contactEmail: str(t.contactPerson?.email),
    contactPhone: str(t.contactPerson?.telephoneNumber),
    documents: (t.documents ?? [])
      .map((d) => ({ title: str(d.title), url: str(d.url) }))
      .filter((d) => d.url),
    sourceUrl: `https://www.etenders.gov.za/Home/TenderOpportunities/`,
  };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchPage(
  dateFrom: string,
  dateTo: string,
  page: number,
  pageSize: number
): Promise<OcdsRelease[]> {
  const url = `${BASE}?PageNumber=${page}&PageSize=${pageSize}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
  const res = await fetch(url, {
    // Adverts change slowly and this is a third-party service we don't want to
    // hammer on every keystroke; 10 minutes at the edge is plenty fresh for a
    // deadline that is days or weeks away.
    cf: { cacheTtl: 600, cacheEverything: true },
    signal: AbortSignal.timeout(20_000),
    headers: { accept: "application/json" },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`eTenders API returned ${res.status}`);
  }
  const body = (await res.json()) as { releases?: OcdsRelease[] };
  return body.releases ?? [];
}

export interface SearchOptions {
  /** Free text matched against subject, tender number and department. */
  keyword?: string;
  province?: string;
  /** OCDS mainProcurementCategory: goods | services | works. */
  category?: string;
  /** How far back to look for adverts. */
  advertisedWithinDays?: number;
  /** Drop anything whose closing date has already passed. */
  openOnly?: boolean;
  limit?: number;
}

export interface SearchResult {
  tenders: RemoteTender[];
  /** How many adverts were examined before filtering. */
  scanned: number;
}

/**
 * Searches recently advertised tenders.
 *
 * Paged through rather than requested wholesale so one slow upstream page
 * doesn't stall the request, and capped so a wide search can't run away.
 */
export async function searchTenders(
  options: SearchOptions = {}
): Promise<SearchResult> {
  const {
    keyword = "",
    province = "",
    category = "",
    advertisedWithinDays = 60,
    openOnly = true,
    limit = 60,
  } = options;

  const now = new Date();
  const from = new Date(now.getTime() - advertisedWithinDays * 864e5);
  const dateFrom = ymd(from);
  // A day ahead, since adverts are stamped at midnight.
  const dateTo = ymd(new Date(now.getTime() + 864e5));

  const raw: OcdsRelease[] = [];
  const PAGE_SIZE = 100;
  const MAX_PAGES = 6;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(dateFrom, dateTo, page, PAGE_SIZE);
    raw.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const terms = keyword
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const tenders: RemoteTender[] = [];

  for (const release of raw) {
    const t = normalise(release);
    if (!t || seen.has(t.ocid)) continue;

    if (openOnly) {
      if (!t.closingAt) continue;
      if (new Date(t.closingAt).getTime() < now.getTime()) continue;
    }
    if (province && t.province.toLowerCase() !== province.toLowerCase()) continue;
    if (category && t.category.toLowerCase() !== category.toLowerCase()) continue;

    if (terms.length) {
      const haystack = `${t.title} ${t.reference} ${t.department} ${t.deliveryLocation}`.toLowerCase();
      // Every term must appear, so extra words narrow rather than widen.
      if (!terms.every((term) => haystack.includes(term))) continue;
    }

    seen.add(t.ocid);
    tenders.push(t);
  }

  // Soonest deadline first: that is the one that needs a decision today.
  tenders.sort((a, b) => (a.closingAt ?? "").localeCompare(b.closingAt ?? ""));

  return { tenders: tenders.slice(0, limit), scanned: raw.length };
}

/** Fetches a single advert by ocid, for import. */
export async function getRemoteTender(ocid: string): Promise<RemoteTender | null> {
  const res = await fetch(`${BASE}/release/${encodeURIComponent(ocid)}`, {
    cf: { cacheTtl: 600, cacheEverything: true },
    signal: AbortSignal.timeout(20_000),
    headers: { accept: "application/json" },
  } as RequestInit);

  if (!res.ok) return null;
  const body = (await res.json()) as { releases?: OcdsRelease[] } & OcdsRelease;
  const release = body.releases?.[0] ?? body;
  return normalise(release);
}
