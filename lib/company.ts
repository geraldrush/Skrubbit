/**
 * Company particulars used by the generated tender documents.
 *
 * Separate from data/site.ts, which holds shop-facing marketing details. These
 * are the legal particulars a bid needs — registration number, VAT number,
 * addresses, who signs — and they live in D1 so they can be corrected without
 * a redeploy.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

export interface CompanyProfile {
  legalName: string;
  tradingName: string;
  registrationNumber: string;
  vatNumber: string;
  /** Explicit, not inferred from the VAT number: a bid must never quote VAT
      that cannot lawfully be charged. */
  vatRegistered: boolean;
  physicalAddress: string;
  postalAddress: string;
  signatoryName: string;
  signatoryPosition: string;
  phone: string;
  email: string;
  website: string;
  profileText: string;
  /** Where deadline reminders go. Separate from `email`, which is the business
   *  address printed on bid documents and is often an unwatched shared inbox. */
  notifyEmail: string;
  /** Provinces whose new adverts are worth an email, comma-separated. Empty
   *  turns the new-tender alerts off; the deadline reminders are unaffected. */
  alertProvinces: string;
  /* Registration particulars, printed in the profile's particulars table.
     Kept as fields rather than prose because a buyer checks them against CIPC,
     SARS, CSD and the B-BBEE affidavit, and a mismatch sinks a submission. */
  annualTurnover: string;
  taxNumber: string;
  csdNumber: string;
  bbbeeStatus: string;
  bankDetails: string;
}

interface ProfileRow {
  legal_name: string;
  trading_name: string;
  registration_number: string;
  vat_number: string;
  vat_registered: number;
  physical_address: string;
  postal_address: string;
  signatory_name: string;
  signatory_position: string;
  phone: string;
  email: string;
  website: string;
  profile_text: string;
  notify_email: string;
  alert_provinces: string;
  annual_turnover: string;
  tax_number: string;
  csd_number: string;
  bbbee_status: string;
  bank_details: string;
}

const EMPTY: CompanyProfile = {
  legalName: "",
  tradingName: "",
  registrationNumber: "",
  vatNumber: "",
  vatRegistered: false,
  physicalAddress: "",
  postalAddress: "",
  signatoryName: "",
  signatoryPosition: "",
  phone: "",
  email: "",
  website: "",
  profileText: "",
  notifyEmail: "",
  alertProvinces: "",
  annualTurnover: "",
  taxNumber: "",
  csdNumber: "",
  bbbeeStatus: "",
  bankDetails: "",
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const row = await db()
    .prepare("SELECT * FROM company_profile WHERE id = 1")
    .first<ProfileRow>();
  if (!row) return EMPTY;

  return {
    legalName: row.legal_name,
    tradingName: row.trading_name,
    registrationNumber: row.registration_number,
    vatNumber: row.vat_number,
    vatRegistered: row.vat_registered === 1,
    physicalAddress: row.physical_address,
    postalAddress: row.postal_address,
    signatoryName: row.signatory_name,
    signatoryPosition: row.signatory_position,
    phone: row.phone,
    email: row.email,
    website: row.website,
    profileText: row.profile_text,
    notifyEmail: row.notify_email ?? "",
    alertProvinces: row.alert_provinces ?? "",
    annualTurnover: row.annual_turnover ?? "",
    taxNumber: row.tax_number ?? "",
    csdNumber: row.csd_number ?? "",
    bbbeeStatus: row.bbbee_status ?? "",
    bankDetails: row.bank_details ?? "",
  };
}

/**
 * The profile, or blanks if there is no database to ask.
 *
 * The footer shows the registration particulars on every page, and the root
 * layout is rendered during static generation too — where there is no
 * Cloudflare context and `getCloudflareContext` throws. A 404 page must not
 * fail to build because the company record was unreachable, so chrome that
 * merely decorates a page reads through this and degrades to nothing.
 *
 * Anything that would be WRONG rather than merely absent must keep using
 * getCompanyProfile() and let the error surface.
 */
export async function getCompanyProfileSafe(): Promise<CompanyProfile> {
  try {
    return await getCompanyProfile();
  } catch {
    return EMPTY;
  }
}

export async function updateCompanyProfile(p: CompanyProfile): Promise<void> {
  await db()
    .prepare(
      `UPDATE company_profile SET
         legal_name = ?, trading_name = ?, registration_number = ?,
         vat_number = ?, vat_registered = ?, physical_address = ?, postal_address = ?,
         signatory_name = ?, signatory_position = ?, phone = ?, email = ?,
         website = ?, profile_text = ?, notify_email = ?, alert_provinces = ?,
         annual_turnover = ?, tax_number = ?, csd_number = ?, bbbee_status = ?,
         bank_details = ?, updated_at = datetime('now')
       WHERE id = 1`
    )
    .bind(
      p.legalName,
      p.tradingName,
      p.registrationNumber,
      p.vatNumber,
      p.vatRegistered ? 1 : 0,
      p.physicalAddress,
      p.postalAddress,
      p.signatoryName,
      p.signatoryPosition,
      p.phone,
      p.email,
      p.website,
      p.profileText,
      p.notifyEmail,
      p.alertProvinces,
      p.annualTurnover,
      p.taxNumber,
      p.csdNumber,
      p.bbbeeStatus,
      p.bankDetails
    )
    .run();
}

/**
 * Particulars a tender document cannot credibly go out without.
 *
 * Surfaced as warnings on the pack rather than blocking it: a draft is worth
 * printing to read through, but it should be obvious what is still missing
 * before it goes in an envelope.
 */
export function missingProfileFields(p: CompanyProfile): string[] {
  const required: Array<[keyof CompanyProfile, string]> = [
    ["legalName", "Registered company name"],
    ["registrationNumber", "CIPC registration number"],
    ["physicalAddress", "Physical address"],
    ["signatoryName", "Name of the person signing"],
    ["phone", "Telephone number"],
    ["email", "Email address"],
  ];
  return required
    .filter(([key]) => {
      const value = p[key];
      // Only text fields are checked for emptiness; vatRegistered is a boolean
      // and false is a valid, complete answer rather than a missing one.
      return typeof value === "string" && !value.trim();
    })
    .map(([, label]) => label);
}
