/**
 * Shared validation for the tender and company-document admin endpoints,
 * mirroring lib/product-validation.ts so both create and edit enforce the
 * same rules.
 */

import type {
  DocumentInput,
  DocumentKind,
  SubmissionMethod,
  TenderInput,
  TenderStatus,
} from "@/lib/tenders";

const STATUSES: TenderStatus[] = [
  "preparing",
  "submitted",
  "won",
  "lost",
  "abandoned",
];

const KINDS: DocumentKind[] = [
  "cipc",
  "id_copy",
  "tax_pin",
  "csd_report",
  "bbbee",
  "coida",
  "cidb",
  "professional_body",
  "other",
];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Normalises a datetime-local value ("2026-09-01T11:00") to an explicit SAST
 * offset. Deadlines are the one field that must never be ambiguous, and a bare
 * local string would be interpreted against whatever zone happens to read it.
 */
function toSastIso(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  // Already carries an offset or Z — trust it.
  if (/[+-]\d{2}:\d{2}$/.test(raw) || raw.endsWith("Z")) {
    return Number.isNaN(new Date(raw).getTime()) ? null : raw;
  }
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00` : raw;
  const candidate = `${withSeconds}+02:00`;
  return Number.isNaN(new Date(candidate).getTime()) ? null : candidate;
}

/** Plain calendar date, as stored for certificate validity. */
function toDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return Number.isNaN(new Date(`${raw}T12:00:00+02:00`).getTime()) ? null : raw;
}

/** B-BBEE contribution levels run 1 (strongest) to 8, plus non-compliant. */
function toLevel(value: unknown, errors: string[], field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    errors.push(`${field} must be a B-BBEE level between 1 and 8.`);
    return null;
  }
  return n;
}

export function validateTenderBody(
  body: Record<string, unknown>
): { errors: string[] } | { value: TenderInput } {
  const errors: string[] = [];

  const reference = str(body.reference);
  const title = str(body.title);
  if (!reference) errors.push("Tender reference is required.");
  if (!title) errors.push("Title is required.");

  const closingAt = toSastIso(str(body.closingAt));
  if (!closingAt) {
    errors.push("A valid closing date and time is required.");
  }

  // Only invalid if supplied and unparseable — a tender may have no briefing.
  const rawBriefing = str(body.briefingAt);
  const briefingAt = rawBriefing ? toSastIso(rawBriefing) : null;
  if (rawBriefing && !briefingAt) {
    errors.push("Briefing date is not a valid date and time.");
  }

  const submissionMethod: SubmissionMethod =
    str(body.submissionMethod) === "electronic" ? "electronic" : "physical";

  const status = str(body.status) || "preparing";
  if (!STATUSES.includes(status as TenderStatus)) {
    errors.push(`Status must be one of: ${STATUSES.join(", ")}.`);
  }

  const bbbeeClaimedLevel = toLevel(
    body.bbbeeClaimedLevel,
    errors,
    "Claimed B-BBEE level"
  );

  if (errors.length) return { errors };

  return {
    value: {
      reference,
      title,
      department: str(body.department),
      description: str(body.description),
      closingAt: closingAt!,
      briefingAt,
      briefingCompulsory: body.briefingCompulsory === true,
      briefingAttended: body.briefingAttended === true,
      submissionMethod,
      submissionDetail: str(body.submissionDetail),
      bbbeeClaimedLevel,
      status: status as TenderStatus,
      notes: str(body.notes),
    },
  };
}

export function validateDocumentBody(
  body: Record<string, unknown>
): { errors: string[] } | { value: DocumentInput } {
  const errors: string[] = [];

  const kind = str(body.kind);
  const label = str(body.label);
  if (!KINDS.includes(kind as DocumentKind)) {
    errors.push(`Document type must be one of: ${KINDS.join(", ")}.`);
  }
  if (!label) errors.push("A label is required.");

  const rawIssued = str(body.issuedOn);
  const issuedOn = rawIssued ? toDate(rawIssued) : null;
  if (rawIssued && !issuedOn) errors.push("Issue date must be YYYY-MM-DD.");

  const rawExpires = str(body.expiresOn);
  const expiresOn = rawExpires ? toDate(rawExpires) : null;
  if (rawExpires && !expiresOn) errors.push("Expiry date must be YYYY-MM-DD.");

  if (issuedOn && expiresOn && expiresOn < issuedOn) {
    errors.push("Expiry date cannot be before the issue date.");
  }

  const bbbeeLevel = toLevel(body.bbbeeLevel, errors, "B-BBEE level");
  // The level is what the SBD 6.1 overclaim check compares against, so a
  // B-BBEE record without one silently disables that check.
  if (kind === "bbbee" && bbbeeLevel === null) {
    errors.push(
      "A B-BBEE record needs its contribution level, or SBD 6.1 claims can't be checked against it."
    );
  }

  if (errors.length) return { errors };

  return {
    value: {
      kind: kind as DocumentKind,
      label,
      reference: str(body.reference),
      issuedOn,
      expiresOn,
      bbbeeLevel,
      location: str(body.location),
      notes: str(body.notes),
    },
  };
}
