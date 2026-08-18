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
  | "financial"
  /** Final actions before the envelope goes in — not returnable documents. */
  | "submission";

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
  /* Import provenance — set when the tender came from the eTenders feed, and
     not editable by hand, so the record always points back at its advert. */
  ocid: string | null;
  sourceUrl: string;
  province: string;
  category: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** Tender-specific override of the company profile paragraphs. */
  profileOverride: string;
  methodology: string;
  experience: string;
  /* What was actually submitted, and the proof of it. */
  submittedAt: string | null;
  submittedBy: string;
  submittedMethod: string;
  submittedAmount: number | null;
  submittedReference: string;
  receiptFileKey: string | null;
  receiptFileName: string;
  receiptFileType: string;
  receiptFileSize: number;
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
  /** Company document that evidences this row, when one does. */
  documentId: number | null;
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
  /** R2 object key under `documents/`, or null when no file is stored. */
  fileKey: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  /** Whether a Commissioner of Oaths must certify the copy. */
  requiresCertification: boolean;
  /** When it was last certified, or null if never. */
  certifiedOn: string | null;
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  preliminary: "Preliminary",
  identity: "Identity & Legal",
  tax: "Tax & Compliance",
  sbd: "SBD Forms",
  sector: "Sector Specific",
  technical: "Technical / Functionality",
  financial: "Financial / Pricing",
  submission: "Before you submit",
};

export const CATEGORY_ORDER: ItemCategory[] = [
  "preliminary",
  "identity",
  "tax",
  "sbd",
  "technical",
  "financial",
  "sector",
  "submission",
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

  // Actions for the day of submission, not returnable documents. required:false
  // keeps them out of the printed pack and out of the readiness blockers, where
  // they would otherwise sit as permanent noise from the day a tender is added.
  { category: "submission", label: "Pack printed in full and every page present", required: false },
  { category: "submission", label: "Official MBD/SBD forms completed and inserted behind the matching dividers", required: false },
  { category: "submission", label: "Every signature page signed by hand, in black ink", required: false },
  { category: "submission", label: "Certified copies enclosed where the tender requires them", required: false },
  { category: "submission", label: "All pages numbered", required: false },
  { category: "submission", label: "No blank fields anywhere — N/A written where something does not apply", required: false },
  { category: "submission", label: "Envelope sealed and marked with the bid number and description", required: false },
  { category: "submission", label: "Delivered to the tender box or portal, with time to spare", required: false },
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
  const missing = items.filter((i) => i.required && !isSatisfied(i, docs));
  for (const item of missing) {
    issues.push({ severity: "blocker", message: `Not attached: ${item.label}` });
  }

  // A linked document with no file uploaded is a claim dressed as evidence.
  for (const item of items.filter((i) => i.required && i.documentId !== null)) {
    const doc = docs.find((d) => d.id === item.documentId);
    if (doc && !doc.fileKey && !item.attached) {
      issues.push({
        severity: "warning",
        message: `${item.label} is linked to "${doc.label}", but no file has been uploaded for it.`,
      });
    }
  }

  const unsigned = items.filter(
    (i) => i.required && isSatisfied(i, docs) && i.signatureRequired && !i.signed
  );
  for (const item of unsigned) {
    issues.push({
      severity: "blocker",
      message: `Not signed: ${item.label} — unsigned forms are the most common disqualification.`,
    });
  }

  /* 5. "If a section does not apply, write N/A rather than leaving it empty." */
  // Submission steps are excluded: they are actions to take on the day, not
  // returnables needing an N/A decision, and eight permanent warnings would
  // drown the ones that matter.
  const blank = items.filter(
    (i) =>
      i.category !== "submission" &&
      !i.required &&
      !isSatisfied(i, docs) &&
      !i.note.trim()
  );
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

  /* 6b. Certified copies go stale. Most tenders want a copy certified within
        the last 3-6 months, so one older than 3 months is flagged and one that
        has never been certified is a blocker on a document that needs it.
        Nothing here certifies anything — only a Commissioner of Oaths can. */
  for (const doc of docs) {
    if (!doc.requiresCertification) continue;
    if (!doc.certifiedOn) {
      issues.push({
        severity: "blocker",
        message: `${doc.label} must be a certified copy and has not been certified yet.`,
      });
      continue;
    }
    const ageDays = hoursBetween(endOfDay(doc.certifiedOn), now) / 24;
    if (ageDays > 90) {
      issues.push({
        severity: "warning",
        message: `${doc.label} was certified ${doc.certifiedOn}, about ${Math.round(ageDays)} days ago — most tenders want one certified within 3 months.`,
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

  /* 8b. A submitted bid with no record of what went in is the position you
        least want to be in if the municipality later says nothing arrived. */
  if (tender.status === "submitted" && !tender.submittedAt) {
    issues.push({
      severity: "warning",
      message:
        "Marked submitted, but no submission date, method or proof of delivery is recorded.",
    });
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

/**
 * Whether a checklist row is actually satisfied.
 *
 * A tick is a claim; a linked company document with a stored file is evidence.
 * Either counts, because plenty of returnables are forms completed on the day
 * and will never have a file — but where a file exists, the row no longer
 * depends on somebody remembering to tick it.
 */
export function isSatisfied(
  item: TenderItem,
  documents: CompanyDocument[] = []
): boolean {
  if (item.attached) return true;
  if (item.documentId === null) return false;
  const doc = documents.find((d) => d.id === item.documentId);
  return Boolean(doc?.fileKey);
}

export interface Progress {
  done: number;
  total: number;
  /** 0-100, and 100 when nothing is required (there is nothing left to do). */
  pct: number;
}

/**
 * How much of the matrix is actually finished.
 *
 * A row counts as done only when it is attached *and*, where a signature is
 * needed, signed — the same bar the readiness check applies, so the progress
 * bar can never read 100% while the bid is still blocked.
 */
export function matrixProgress(
  items: TenderItem[],
  documents: CompanyDocument[] = []
): Progress {
  const required = items.filter((i) => i.required);
  const done = required.filter(
    (i) => isSatisfied(i, documents) && (!i.signatureRequired || i.signed)
  ).length;
  const total = required.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 100 };
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
  ocid: string | null;
  source_url: string;
  province: string;
  category: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  profile_override: string;
  methodology: string;
  experience: string;
  submitted_at: string | null;
  submitted_by: string;
  submitted_method: string;
  submitted_amount: number | null;
  submitted_reference: string;
  receipt_file_key: string | null;
  receipt_file_name: string;
  receipt_file_type: string;
  receipt_file_size: number;
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
    ocid: r.ocid,
    sourceUrl: r.source_url ?? "",
    province: r.province ?? "",
    category: r.category ?? "",
    contactName: r.contact_name ?? "",
    contactEmail: r.contact_email ?? "",
    contactPhone: r.contact_phone ?? "",
    profileOverride: r.profile_override ?? "",
    methodology: r.methodology ?? "",
    experience: r.experience ?? "",
    submittedAt: r.submitted_at,
    submittedBy: r.submitted_by ?? "",
    submittedMethod: r.submitted_method ?? "",
    submittedAmount: r.submitted_amount,
    submittedReference: r.submitted_reference ?? "",
    receiptFileKey: r.receipt_file_key,
    receiptFileName: r.receipt_file_name ?? "",
    receiptFileType: r.receipt_file_type ?? "",
    receiptFileSize: r.receipt_file_size ?? 0,
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
  document_id: number | null;
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
    documentId: r.document_id,
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
  file_key: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  requires_certification: number;
  certified_on: string | null;
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
    fileKey: r.file_key,
    fileName: r.file_name ?? "",
    fileType: r.file_type ?? "",
    fileSize: r.file_size ?? 0,
    requiresCertification: r.requires_certification === 1,
    certifiedOn: r.certified_on,
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
  profileOverride: string;
  methodology: string;
  experience: string;
  submittedAt: string | null;
  submittedBy: string;
  submittedMethod: string;
  submittedAmount: number | null;
  submittedReference: string;
}

/** The seeded compliance matrix, shared by manual creation and import. */
function matrixStatements(d: D1Database, tenderId: number): D1PreparedStatement[] {
  return defaultMatrix().map((item, i) =>
    d
      .prepare(
        `INSERT INTO tender_items
           (tender_id, category, label, required, signature_required, position)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        tenderId,
        item.category,
        item.label,
        item.required === false ? 0 : 1,
        item.signatureRequired ? 1 : 0,
        i
      )
  );
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

  await d.batch(matrixStatements(d, id));
  return id;
}

/**
 * Which adverts are already in the register.
 *
 * Reads every imported ocid rather than binding one parameter per candidate:
 * D1 caps a query at 100 bound parameters, so a search returning more results
 * than that failed outright with a 500. The register only holds bids actually
 * being pursued, so this set stays small and the matching is done in memory.
 */
export async function findImportedOcids(): Promise<Set<string>> {
  const { results } = await db()
    .prepare("SELECT ocid FROM tenders WHERE ocid IS NOT NULL")
    .all<{ ocid: string }>();
  return new Set(results.map((r) => r.ocid));
}

export interface RemoteImport {
  ocid: string;
  reference: string;
  title: string;
  description: string;
  department: string;
  closingAt: string;
  briefingAt: string | null;
  briefingCompulsory: boolean;
  submissionDetail: string;
  province: string;
  category: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  sourceUrl: string;
}

/**
 * Creates a tender from an eTenders advert, matrix and all.
 *
 * Returns the existing id if this advert is already in the register, so a
 * double-click or a second import from a stale search page is a no-op rather
 * than a duplicate bid to keep track of.
 */
export async function importTender(remote: RemoteImport): Promise<number> {
  const d = db();

  const existing = await d
    .prepare("SELECT id FROM tenders WHERE ocid = ?")
    .bind(remote.ocid)
    .first<{ id: number }>();
  if (existing) return existing.id;

  const inserted = await d
    .prepare(
      `INSERT INTO tenders
         (reference, title, department, description, closing_at, briefing_at,
          briefing_compulsory, briefing_attended, submission_method,
          submission_detail, bbbee_claimed_level, status, notes,
          ocid, source_url, province, category,
          contact_name, contact_email, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'physical', ?, NULL, 'preparing', '',
               ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(
      remote.reference,
      remote.title,
      remote.department,
      remote.description,
      remote.closingAt,
      remote.briefingAt,
      remote.briefingCompulsory ? 1 : 0,
      remote.submissionDetail,
      remote.ocid,
      remote.sourceUrl,
      remote.province,
      remote.category,
      remote.contactName,
      remote.contactEmail,
      remote.contactPhone
    )
    .first<{ id: number }>();

  const id = inserted!.id;
  await d.batch(matrixStatements(d, id));
  return id;
}

export async function updateTender(id: number, input: TenderInput): Promise<void> {
  await db()
    .prepare(
      `UPDATE tenders SET
         reference = ?, title = ?, department = ?, description = ?,
         closing_at = ?, briefing_at = ?, briefing_compulsory = ?,
         briefing_attended = ?, submission_method = ?, submission_detail = ?,
         bbbee_claimed_level = ?, status = ?, notes = ?,
         profile_override = ?, methodology = ?, experience = ?,
         submitted_at = ?, submitted_by = ?, submitted_method = ?,
         submitted_amount = ?, submitted_reference = ?
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
      input.profileOverride,
      input.methodology,
      input.experience,
      input.submittedAt,
      input.submittedBy,
      input.submittedMethod,
      input.submittedAmount,
      input.submittedReference,
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
  documentId: number | null;
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
             SET attached = ?, signed = ?, required = ?, note = ?, document_id = ?
           WHERE id = ? AND tender_id = ?`
        )
        .bind(
          p.attached ? 1 : 0,
          p.signed ? 1 : 0,
          p.required ? 1 : 0,
          p.note,
          p.documentId,
          p.id,
          tenderId
        )
    )
  );
}

export interface NewItemInput {
  category: ItemCategory;
  label: string;
  required: boolean;
  signatureRequired: boolean;
}

/**
 * Appends rows to a tender's matrix.
 *
 * Real tender packs carry returnables the seeded checklist cannot know about —
 * a JV agreement, municipal rates clearance, a sector certificate. Without
 * this the only way to add one was editing the database by hand, which is not
 * a thing the person assembling a bid at 9pm can do.
 */
export async function addItems(
  tenderId: number,
  items: NewItemInput[]
): Promise<void> {
  if (!items.length) return;
  const d = db();

  const last = await d
    .prepare("SELECT COALESCE(MAX(position), -1) AS p FROM tender_items WHERE tender_id = ?")
    .bind(tenderId)
    .first<{ p: number }>();
  let position = (last?.p ?? -1) + 1;

  await d.batch(
    items.map((item) =>
      d
        .prepare(
          `INSERT INTO tender_items
             (tender_id, category, label, required, signature_required, position)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          tenderId,
          item.category,
          item.label,
          item.required ? 1 : 0,
          item.signatureRequired ? 1 : 0,
          position++
        )
    )
  );
}

/**
 * Removes rows from a tender's matrix.
 *
 * One statement per id rather than an IN list: D1 caps a query at 100 bound
 * parameters, and a long selection would fail outright. Each delete is scoped
 * by tender_id as well, so an id from another tender cannot be removed.
 */
export async function deleteItems(tenderId: number, ids: number[]): Promise<void> {
  if (!ids.length) return;
  const d = db();
  await d.batch(
    ids.map((id) =>
      d
        .prepare("DELETE FROM tender_items WHERE id = ? AND tender_id = ?")
        .bind(id, tenderId)
    )
  );
}

/* --------------------------- tender file vault --------------------------- */

export type TenderFileKind =
  | "tender_document"
  | "official_forms"
  | "boq"
  | "briefing_proof"
  | "addendum"
  | "correspondence"
  | "other";

export const TENDER_FILE_LABELS: Record<TenderFileKind, string> = {
  tender_document: "Tender document / advert",
  official_forms: "Official MBD / SBD forms",
  boq: "Bill of quantities / specification",
  briefing_proof: "Briefing attendance proof",
  addendum: "Addendum / clarification",
  correspondence: "Correspondence with the buyer",
  other: "Other",
};

export interface TenderFile {
  id: number;
  kind: TenderFileKind;
  label: string;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface TenderFileRow {
  id: number;
  kind: string;
  label: string;
  file_key: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export async function listTenderFiles(tenderId: number): Promise<TenderFile[]> {
  const { results } = await db()
    .prepare("SELECT * FROM tender_files WHERE tender_id = ? ORDER BY uploaded_at DESC, id DESC")
    .bind(tenderId)
    .all<TenderFileRow>();

  return results.map((r) => ({
    id: r.id,
    kind: r.kind as TenderFileKind,
    label: r.label,
    fileKey: r.file_key,
    fileName: r.file_name,
    fileType: r.file_type,
    fileSize: r.file_size,
    uploadedAt: r.uploaded_at,
  }));
}

export async function getTenderFile(
  tenderId: number,
  fileId: number
): Promise<TenderFile | null> {
  const row = await db()
    .prepare("SELECT * FROM tender_files WHERE id = ? AND tender_id = ?")
    .bind(fileId, tenderId)
    .first<TenderFileRow>();
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind as TenderFileKind,
    label: row.label,
    fileKey: row.file_key,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedAt: row.uploaded_at,
  };
}

export async function addTenderFile(
  tenderId: number,
  file: { kind: TenderFileKind; label: string; key: string; name: string; type: string; size: number }
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO tender_files
         (tender_id, kind, label, file_key, file_name, file_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(tenderId, file.kind, file.label, file.key, file.name, file.type, file.size)
    .run();
}

export async function deleteTenderFile(tenderId: number, fileId: number): Promise<void> {
  await db()
    .prepare("DELETE FROM tender_files WHERE id = ? AND tender_id = ?")
    .bind(fileId, tenderId)
    .run();
}

export async function deleteTender(id: number): Promise<void> {
  const d = db();
  // Explicit rather than relying on ON DELETE CASCADE, which only fires when
  // SQLite foreign-key enforcement is on — same reasoning as lib/products.ts.
  await d.batch([
    d.prepare("DELETE FROM tender_items WHERE tender_id = ?").bind(id),
    d.prepare("DELETE FROM tender_pricing WHERE tender_id = ?").bind(id),
    d.prepare("DELETE FROM tender_files WHERE tender_id = ?").bind(id),
    d.prepare("DELETE FROM tenders WHERE id = ?").bind(id),
  ]);
}

/* ---------------------------- pricing schedule --------------------------- */

/** South African VAT. */
export const VAT_RATE = 0.15;

export interface PricingLine {
  id: number;
  description: string;
  unit: string;
  quantity: number;
  /** What we pay. Never printed on the submitted schedule. */
  costPrice: number;
  /** What we quote, excluding VAT. */
  unitPrice: number;
  productSlug: string | null;
  position: number;
}

export interface PricingTotals {
  excl: number;
  vat: number;
  incl: number;
  /** Quoted minus cost. Internal only — margin never goes in the envelope. */
  margin: number;
  marginPct: number;
}

export function priceTotals(lines: PricingLine[]): PricingTotals {
  const excl = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const cost = lines.reduce((s, l) => s + l.quantity * l.costPrice, 0);
  const vat = excl * VAT_RATE;
  const margin = excl - cost;
  return {
    excl,
    vat,
    incl: excl + vat,
    margin,
    marginPct: excl > 0 ? (margin / excl) * 100 : 0,
  };
}

interface PricingRow {
  id: number;
  description: string;
  unit: string;
  quantity: number;
  cost_price: number;
  unit_price: number;
  product_slug: string | null;
  position: number;
}

export async function getPricing(tenderId: number): Promise<PricingLine[]> {
  const { results } = await db()
    .prepare("SELECT * FROM tender_pricing WHERE tender_id = ? ORDER BY position")
    .bind(tenderId)
    .all<PricingRow>();

  return results.map((r) => ({
    id: r.id,
    description: r.description,
    unit: r.unit,
    quantity: r.quantity,
    costPrice: r.cost_price,
    unitPrice: r.unit_price,
    productSlug: r.product_slug,
    position: r.position,
  }));
}

export interface PricingInput {
  description: string;
  unit: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  productSlug: string | null;
}

/**
 * Replaces the whole schedule.
 *
 * Same wholesale approach as the compliance matrix and product variants: the
 * line set is small, rows are reordered and deleted freely while quoting, and
 * a full replace is easier to reason about than diffing by id.
 */
export async function replacePricing(
  tenderId: number,
  lines: PricingInput[]
): Promise<void> {
  const d = db();
  await d.batch([
    d.prepare("DELETE FROM tender_pricing WHERE tender_id = ?").bind(tenderId),
    ...lines.map((l, i) =>
      d
        .prepare(
          `INSERT INTO tender_pricing
             (tender_id, description, unit, quantity, cost_price, unit_price,
              product_slug, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          tenderId,
          l.description,
          l.unit,
          l.quantity,
          l.costPrice,
          l.unitPrice,
          l.productSlug,
          i
        )
    ),
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
  requiresCertification: boolean;
  certifiedOn: string | null;
}

export async function createDocument(input: DocumentInput): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO company_documents
         (kind, label, reference, issued_on, expires_on, bbbee_level, location,
          notes, requires_certification, certified_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      input.requiresCertification ? 1 : 0,
      input.certifiedOn
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
         bbbee_level = ?, location = ?, notes = ?, requires_certification = ?,
         certified_on = ?, updated_at = datetime('now')
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
      input.requiresCertification ? 1 : 0,
      input.certifiedOn,
      id
    )
    .run();
}

export async function deleteDocument(id: number): Promise<void> {
  await db().prepare("DELETE FROM company_documents WHERE id = ?").bind(id).run();
}

export async function getDocument(id: number): Promise<CompanyDocument | null> {
  const row = await db()
    .prepare("SELECT * FROM company_documents WHERE id = ?")
    .bind(id)
    .first<DocRow>();
  return row ? toDoc(row) : null;
}

/** Records the stored file against a document, replacing any previous one. */
export async function setDocumentFile(
  id: number,
  file: { key: string; name: string; type: string; size: number }
): Promise<void> {
  await db()
    .prepare(
      `UPDATE company_documents
          SET file_key = ?, file_name = ?, file_type = ?, file_size = ?,
              updated_at = datetime('now')
        WHERE id = ?`
    )
    .bind(file.key, file.name, file.type, file.size, id)
    .run();
}

export async function clearDocumentFile(id: number): Promise<void> {
  await db()
    .prepare(
      `UPDATE company_documents
          SET file_key = NULL, file_name = '', file_type = '', file_size = 0,
              updated_at = datetime('now')
        WHERE id = ?`
    )
    .bind(id)
    .run();
}
