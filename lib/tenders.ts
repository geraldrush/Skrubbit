/**
 * Tender preparation: register, compliance matrix, and company document vault.
 *
 * The domain rules here come from the SA eTenders guide. Everything is aimed
 * at the six disqualification reasons in its section 4 — a bid that trips any
 * of them is rejected before evaluation, so the point of this module is to
 * surface them while there is still time to fix them.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

/* -------------------------------- types -------------------------------- */

export type TenderStatus =
  | "preparing"
  | "submitted"
  | "won"
  | "lost"
  | "abandoned";

export type SubmissionMethod = "physical" | "electronic";

export type ItemCategory =
  | "preliminary"
  | "identity"
  | "tax"
  | "sbd"
  | "sector"
  | "technical"
  | "financial";

export type DocumentKind =
  | "cipc"
  | "id_copy"
  | "tax_pin"
  | "csd_report"
  | "bbbee"
  | "coida"
  | "cidb"
  | "professional_body"
  | "other";

export interface Tender {
  id: number;
  reference: string;
  title: string;
  department: string;
  description: string;
  closingAt: string;
  briefingAt: string | null;
  briefingCompulsory: boolean;
  briefingAttended: boolean;
  submissionMethod: SubmissionMethod;
  submissionDetail: string;
  bbbeeClaimedLevel: number | null;
  status: TenderStatus;
  notes: string;
  createdAt: string;
}

export interface TenderItem {
  id: number;
  category: ItemCategory;
  label: string;
  required: boolean;
  attached: boolean;
  signatureRequired: boolean;
  signed: boolean;
  note: string;
  position: number;
}

export interface CompanyDocument {
  id: number;
  kind: DocumentKind;
  label: string;
  reference: string;
  issuedOn: string | null;
  expiresOn: string | null;
  bbbeeLevel: number | null;
  location: string;
  notes: string;
  updatedAt: string;
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  preliminary: "Preliminary",
  identity: "Identity & Legal",
  tax: "Tax & Compliance",
  sbd: "SBD Forms",
  sector: "Sector Specific",
  technical: "Technical / Functionality",
  financial: "Financial / Pricing",
};

export const CATEGORY_ORDER: ItemCategory[] = [
  "preliminary",
  "identity",
  "tax",
  "sbd",
  "technical",
  "financial",
  "sector",
];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  cipc: "CIPC Registration (COR14.3)",
  id_copy: "Certified ID Copy",
  tax_pin: "SARS Tax Compliance PIN",
  csd_report: "CSD Full Summary Report",
  bbbee: "B-BBEE Certificate / Affidavit",
  coida: "COIDA Letter of Good Standing",
  cidb: "CIDB Certificate",
  professional_body: "Professional Body Registration",
  other: "Other",
};

/* -------------------------- the default matrix -------------------------- */

interface SeedItem {
  category: ItemCategory;
  label: string;
  required?: boolean;
  signatureRequired?: boolean;
}

/**
 * The mandatory checklist, transcribed from sections 1 and 2 of the guide.
 *
 * Seeded onto every new tender so the matrix starts complete and is narrowed
 * down, rather than being built from memory each time — the guide's advice is
 * to list everything up front and tick it off.
 *
 * Sector-specific rows start optional: CIDB only applies to construction and
 * PSIRA to security, so they are listed as prompts rather than blockers until
 * the tender actually calls for them.
 */
const DEFAULT_MATRIX: SeedItem[] = [
  { category: "preliminary", label: "Cover letter on company letterhead", signatureRequired: true },
  { category: "preliminary", label: "Table of contents with page numbers" },
  { category: "preliminary", label: "Executive summary", required: false },

  { category: "identity", label: "CIPC registration documents (COR14.3)" },
  { category: "identity", label: "Certified ID copies for all directors/members" },

  { category: "tax", label: "SARS Tax Compliance PIN (active)" },
  { category: "tax", label: "CSD full summary report" },
  { category: "tax", label: "B-BBEE certificate or sworn affidavit" },

  { category: "sbd", label: "SBD 1 — Invitation to Bid", signatureRequired: true },
  { category: "sbd", label: "SBD 4 — Declaration of Interest", signatureRequired: true },
  { category: "sbd", label: "SBD 6.1 — Preference Points Claim Form", signatureRequired: true },
  { category: "sbd", label: "SBD 8 — Past SCM Practices", signatureRequired: true },
  { category: "sbd", label: "SBD 9 — Independent Bid Determination", signatureRequired: true },

  { category: "technical", label: "Company profile (tailored to this tender)" },
  { category: "technical", label: "Methodology / work plan" },
  { category: "technical", label: "Relevant experience — similar projects" },
  { category: "technical", label: "Reference letters on client letterheads", required: false },
  { category: "technical", label: "CVs and qualifications of key staff", required: false },

  { category: "financial", label: "Pricing schedule (SBD 3.1 / 3.2 / 3.3)", signatureRequired: true },
  { category: "financial", label: "Detailed cost breakdown (VAT inclusive)" },
  { category: "financial", label: "Financial statements", required: false },

  { category: "sector", label: "CIDB certificate (construction only)", required: false },
  { category: "sector", label: "COIDA letter of good standing", required: false },
  { category: "sector", label: "Professional body registration (PSIRA, SAPC, …)", required: false },
];

export function defaultMatrix(): SeedItem[] {
  return DEFAULT_MATRIX.map((i) => ({ ...i }));
}

/* --------------------------- readiness engine --------------------------- */

export interface Issue {
  severity: "blocker" | "warning";
  message: string;
}

/** A date-only value ("2026-09-01") is valid to the end of that day, SAST. */
function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59+02:00`);
}

function formatDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const s = new Date(d.getTime() + 2 * 60 * 60 * 1000);
  return `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())}`;
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 36e5;
}

/** Today's date in SAST as YYYY-MM-DD, for date-only comparisons. */
export function sastToday(now: Date = new Date()): string {
  return formatDay(now);
}

/**
 * A stored closing/briefing timestamp as "YYYY-MM-DD HH:MM".
 *
 * Values are written with an explicit +02:00 offset, so the local wall-clock
 * time is already the leading characters — no conversion, and no chance of a
 * deadline shifting by an hour on the way to the screen.
 */
export function formatDateTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * Everything standing between this tender and a compliant submission.
 *
 * Pure, so the rules can be tested directly. Blockers are things that get a
 * bid thrown out; warnings are things that cost points or are about to become
 * blockers. Order is deliberate — deadline first, because no amount of
 * paperwork rescues a late bid.
 */
export function assessTender(
  tender: Tender,
  items: TenderItem[],
  docs: CompanyDocument[],
  now: Date = new Date()
): Issue[] {
  const issues: Issue[] = [];
  const settled =
    tender.status === "submitted" ||
    tender.status === "won" ||
    tender.status === "lost" ||
    tender.status === "abandoned";

  const closing = new Date(tender.closingAt);

  /* 1. Deadline. "Even being one minute late will result in rejection." */
  if (!settled) {
    const hoursLeft = hoursBetween(now, closing);
    if (hoursLeft < 0) {
      issues.push({
        severity: "blocker",
        message: `Closed on ${formatDay(closing)} and this is still marked "${tender.status}".`,
      });
    } else if (hoursLeft <= 48) {
      issues.push({
        severity: "warning",
        message: `Closes in ${Math.max(1, Math.round(hoursLeft))} hours — allow travel time for a physical drop-off.`,
      });
    }
  }

  /* 2. Compulsory briefing. Missing one is automatic disqualification. */
  if (tender.briefingCompulsory && !tender.briefingAttended) {
    const briefing = tender.briefingAt ? new Date(tender.briefingAt) : null;
    if (!briefing) {
      issues.push({
        severity: "warning",
        message: "Briefing is marked compulsory but has no date recorded.",
      });
    } else if (briefing.getTime() < now.getTime()) {
      issues.push({
        severity: "blocker",
        message: `Compulsory briefing on ${formatDay(briefing)} is not marked attended — missing it disqualifies the bid.`,
      });
    } else {
      issues.push({
        severity: "warning",
        message: `Compulsory briefing on ${formatDay(briefing)}. Missing it disqualifies the bid.`,
      });
    }
  }

  /* 3 & 4. Attachments and signatures. */
  const missing = items.filter((i) => i.required && !i.attached);
  for (const item of missing) {
    issues.push({ severity: "blocker", message: `Not attached: ${item.label}` });
  }

  const unsigned = items.filter(
    (i) => i.required && i.attached && i.signatureRequired && !i.signed
  );
  for (const item of unsigned) {
    issues.push({
      severity: "blocker",
      message: `Not signed: ${item.label} — unsigned forms are the most common disqualification.`,
    });
  }

  /* 5. "If a section does not apply, write N/A rather than leaving it empty." */
  const blank = items.filter((i) => !i.required && !i.attached && !i.note.trim());
  for (const item of blank) {
    issues.push({
      severity: "warning",
      message: `No decision recorded for "${item.label}" — mark it N/A if it doesn't apply.`,
    });
  }

  /* 6. Certificate validity, measured at the closing date rather than today:
        a Tax PIN that lapses the day before closing is already useless. */
  for (const doc of docs) {
    if (!doc.expiresOn) continue;
    const expiry = endOfDay(doc.expiresOn);
    if (expiry.getTime() < closing.getTime()) {
      issues.push({
        severity: "blocker",
        message: `${doc.label} expires ${doc.expiresOn}, before this tender closes on ${formatDay(closing)}.`,
      });
    } else if (hoursBetween(now, expiry) <= 30 * 24) {
      issues.push({
        severity: "warning",
        message: `${doc.label} expires ${doc.expiresOn} — renew it soon.`,
      });
    }
  }

  /* 7. CSD registration is mandatory for every government supplier. */
  if (!docs.some((d) => d.kind === "csd_report")) {
    issues.push({
      severity: "warning",
      message: "No CSD summary report on file — CSD registration is mandatory for all suppliers.",
    });
  }

  /* 8. B-BBEE claim vs certificate. Levels are inverted: Level 1 is the
        strongest, so claiming a *lower* number than the certificate supports
        is the overclaim that gets bids thrown out. Claiming a higher number
        is merely leaving preference points on the table. */
  if (tender.bbbeeClaimedLevel !== null) {
    const cert = docs.find((d) => d.kind === "bbbee" && d.bbbeeLevel !== null);
    if (!cert) {
      issues.push({
        severity: "blocker",
        message: `SBD 6.1 claims Level ${tender.bbbeeClaimedLevel} but no B-BBEE certificate is on file to support it.`,
      });
    } else if (tender.bbbeeClaimedLevel < cert.bbbeeLevel!) {
      issues.push({
        severity: "blocker",
        message: `SBD 6.1 claims Level ${tender.bbbeeClaimedLevel} but the certificate is Level ${cert.bbbeeLevel} — an overclaim disqualifies the bid.`,
      });
    } else if (tender.bbbeeClaimedLevel > cert.bbbeeLevel!) {
      issues.push({
        severity: "warning",
        message: `SBD 6.1 claims Level ${tender.bbbeeClaimedLevel} but the certificate is Level ${cert.bbbeeLevel} — you are giving away preference points.`,
      });
    }
  }

  /* 9. Somewhere to actually deliver it. */
  if (!tender.submissionDetail.trim()) {
    issues.push({
      severity: "warning",
      message:
        tender.submissionMethod === "physical"
          ? "No tender box address recorded."
          : "No submission portal recorded.",
    });
  }

  return issues;
}

export interface Readiness {
  blockers: number;
  warnings: number;
  ready: boolean;
}

export function summarise(issues: Issue[]): Readiness {
  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const warnings = issues.length - blockers;
  return { blockers, warnings, ready: blockers === 0 };
}

/* ------------------------------- queries -------------------------------- */

interface TenderRow {
  id: number;
  reference: string;
  title: string;
  department: string;
  description: string;
  closing_at: string;
  briefing_at: string | null;
  briefing_compulsory: number;
  briefing_attended: number;
  submission_method: string;
  submission_detail: string;
  bbbee_claimed_level: number | null;
  status: string;
  notes: string;
  created_at: string;
}

function toTender(r: TenderRow): Tender {
  return {
    id: r.id,
    reference: r.reference,
    title: r.title,
    department: r.department,
    description: r.description,
    closingAt: r.closing_at,
    briefingAt: r.briefing_at,
    briefingCompulsory: r.briefing_compulsory === 1,
    briefingAttended: r.briefing_attended === 1,
    submissionMethod: r.submission_method === "electronic" ? "electronic" : "physical",
    submissionDetail: r.submission_detail,
    bbbeeClaimedLevel: r.bbbee_claimed_level,
    status: r.status as TenderStatus,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

interface ItemRow {
  id: number;
  tender_id: number;
  category: string;
  label: string;
  required: number;
  attached: number;
  signature_required: number;
  signed: number;
  note: string;
  position: number;
}

function toItem(r: ItemRow): TenderItem {
  return {
    id: r.id,
    category: r.category as ItemCategory,
    label: r.label,
    required: r.required === 1,
    attached: r.attached === 1,
    signatureRequired: r.signature_required === 1,
    signed: r.signed === 1,
    note: r.note,
    position: r.position,
  };
}

interface DocRow {
  id: number;
  kind: string;
  label: string;
  reference: string;
  issued_on: string | null;
  expires_on: string | null;
  bbbee_level: number | null;
  location: string;
  notes: string;
  updated_at: string;
}

function toDoc(r: DocRow): CompanyDocument {
  return {
    id: r.id,
    kind: r.kind as DocumentKind,
    label: r.label,
    reference: r.reference,
    issuedOn: r.issued_on,
    expiresOn: r.expires_on,
    bbbeeLevel: r.bbbee_level,
    location: r.location,
    notes: r.notes,
    updatedAt: r.updated_at,
  };
}

export async function listTenders(): Promise<Tender[]> {
  const { results } = await db()
    .prepare("SELECT * FROM tenders ORDER BY closing_at ASC")
    .all<TenderRow>();
  return results.map(toTender);
}

/** Items for many tenders at once, so the list page stays at two queries. */
export async function itemsByTender(): Promise<Map<number, TenderItem[]>> {
  const { results } = await db()
    .prepare("SELECT * FROM tender_items ORDER BY tender_id, position")
    .all<ItemRow>();
  const map = new Map<number, TenderItem[]>();
  for (const row of results) {
    const list = map.get(row.tender_id) ?? [];
    list.push(toItem(row));
    map.set(row.tender_id, list);
  }
  return map;
}

export async function getTender(
  id: number
): Promise<{ tender: Tender; items: TenderItem[] } | null> {
  const row = await db()
    .prepare("SELECT * FROM tenders WHERE id = ?")
    .bind(id)
    .first<TenderRow>();
  if (!row) return null;

  const { results } = await db()
    .prepare("SELECT * FROM tender_items WHERE tender_id = ? ORDER BY position")
    .bind(id)
    .all<ItemRow>();

  return { tender: toTender(row), items: results.map(toItem) };
}

export interface TenderInput {
  reference: string;
  title: string;
  department: string;
  description: string;
  closingAt: string;
  briefingAt: string | null;
  briefingCompulsory: boolean;
  briefingAttended: boolean;
  submissionMethod: SubmissionMethod;
  submissionDetail: string;
  bbbeeClaimedLevel: number | null;
  status: TenderStatus;
  notes: string;
}

/** Creates the tender and seeds its matrix in one batch. */
export async function createTender(input: TenderInput): Promise<number> {
  const d = db();
  const inserted = await d
    .prepare(
      `INSERT INTO tenders
         (reference, title, department, description, closing_at, briefing_at,
          briefing_compulsory, briefing_attended, submission_method,
          submission_detail, bbbee_claimed_level, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(
      input.reference,
      input.title,
      input.department,
      input.description,
      input.closingAt,
      input.briefingAt,
      input.briefingCompulsory ? 1 : 0,
      input.briefingAttended ? 1 : 0,
      input.submissionMethod,
      input.submissionDetail,
      input.bbbeeClaimedLevel,
      input.status,
      input.notes
    )
    .first<{ id: number }>();

  const id = inserted!.id;

  await d.batch(
    defaultMatrix().map((item, i) =>
      d
        .prepare(
          `INSERT INTO tender_items
             (tender_id, category, label, required, signature_required, position)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          item.category,
          item.label,
          item.required === false ? 0 : 1,
          item.signatureRequired ? 1 : 0,
          i
        )
    )
  );

  return id;
}

export async function updateTender(id: number, input: TenderInput): Promise<void> {
  await db()
    .prepare(
      `UPDATE tenders SET
         reference = ?, title = ?, department = ?, description = ?,
         closing_at = ?, briefing_at = ?, briefing_compulsory = ?,
         briefing_attended = ?, submission_method = ?, submission_detail = ?,
         bbbee_claimed_level = ?, status = ?, notes = ?
       WHERE id = ?`
    )
    .bind(
      input.reference,
      input.title,
      input.department,
      input.description,
      input.closingAt,
      input.briefingAt,
      input.briefingCompulsory ? 1 : 0,
      input.briefingAttended ? 1 : 0,
      input.submissionMethod,
      input.submissionDetail,
      input.bbbeeClaimedLevel,
      input.status,
      input.notes,
      id
    )
    .run();
}

export interface ItemPatch {
  id: number;
  attached: boolean;
  signed: boolean;
  required: boolean;
  note: string;
}

/** Saves the whole matrix at once; ticking boxes shouldn't be N requests. */
export async function updateItems(
  tenderId: number,
  patches: ItemPatch[]
): Promise<void> {
  if (!patches.length) return;
  const d = db();
  await d.batch(
    patches.map((p) =>
      d
        .prepare(
          `UPDATE tender_items
             SET attached = ?, signed = ?, required = ?, note = ?
           WHERE id = ? AND tender_id = ?`
        )
        .bind(
          p.attached ? 1 : 0,
          p.signed ? 1 : 0,
          p.required ? 1 : 0,
          p.note,
          p.id,
          tenderId
        )
    )
  );
}

export async function deleteTender(id: number): Promise<void> {
  const d = db();
  // Explicit rather than relying on ON DELETE CASCADE, which only fires when
  // SQLite foreign-key enforcement is on — same reasoning as lib/products.ts.
  await d.batch([
    d.prepare("DELETE FROM tender_items WHERE tender_id = ?").bind(id),
    d.prepare("DELETE FROM tenders WHERE id = ?").bind(id),
  ]);
}

export async function listDocuments(): Promise<CompanyDocument[]> {
  const { results } = await db()
    .prepare(
      `SELECT * FROM company_documents
       ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END, expires_on, label`
    )
    .all<DocRow>();
  return results.map(toDoc);
}

export interface DocumentInput {
  kind: DocumentKind;
  label: string;
  reference: string;
  issuedOn: string | null;
  expiresOn: string | null;
  bbbeeLevel: number | null;
  location: string;
  notes: string;
}

export async function createDocument(input: DocumentInput): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO company_documents
         (kind, label, reference, issued_on, expires_on, bbbee_level, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.kind,
      input.label,
      input.reference,
      input.issuedOn,
      input.expiresOn,
      input.bbbeeLevel,
      input.location,
      input.notes
    )
    .run();
}

export async function updateDocument(
  id: number,
  input: DocumentInput
): Promise<void> {
  await db()
    .prepare(
      `UPDATE company_documents SET
         kind = ?, label = ?, reference = ?, issued_on = ?, expires_on = ?,
         bbbee_level = ?, location = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      input.kind,
      input.label,
      input.reference,
      input.issuedOn,
      input.expiresOn,
      input.bbbeeLevel,
      input.location,
      input.notes,
      id
    )
    .run();
}

export async function deleteDocument(id: number): Promise<void> {
  await db().prepare("DELETE FROM company_documents WHERE id = ?").bind(id).run();
}
