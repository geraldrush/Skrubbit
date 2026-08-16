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
  physicalAddress: string;
  postalAddress: string;
  signatoryName: string;
  signatoryPosition: string;
  phone: string;
  email: string;
  website: string;
  profileText: string;
}

interface ProfileRow {
  legal_name: string;
  trading_name: string;
  registration_number: string;
  vat_number: string;
  physical_address: string;
  postal_address: string;
  signatory_name: string;
  signatory_position: string;
  phone: string;
  email: string;
  website: string;
  profile_text: string;
}

const EMPTY: CompanyProfile = {
  legalName: "",
  tradingName: "",
  registrationNumber: "",
  vatNumber: "",
  physicalAddress: "",
  postalAddress: "",
  signatoryName: "",
  signatoryPosition: "",
  phone: "",
  email: "",
  website: "",
  profileText: "",
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
    physicalAddress: row.physical_address,
    postalAddress: row.postal_address,
    signatoryName: row.signatory_name,
    signatoryPosition: row.signatory_position,
    phone: row.phone,
    email: row.email,
    website: row.website,
    profileText: row.profile_text,
  };
}

export async function updateCompanyProfile(p: CompanyProfile): Promise<void> {
  await db()
    .prepare(
      `UPDATE company_profile SET
         legal_name = ?, trading_name = ?, registration_number = ?,
         vat_number = ?, physical_address = ?, postal_address = ?,
         signatory_name = ?, signatory_position = ?, phone = ?, email = ?,
         website = ?, profile_text = ?, updated_at = datetime('now')
       WHERE id = 1`
    )
    .bind(
      p.legalName,
      p.tradingName,
      p.registrationNumber,
      p.vatNumber,
      p.physicalAddress,
      p.postalAddress,
      p.signatoryName,
      p.signatoryPosition,
      p.phone,
      p.email,
      p.website,
      p.profileText
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
  return required.filter(([key]) => !p[key].trim()).map(([, label]) => label);
}
