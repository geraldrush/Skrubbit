-- Company particulars for generated tender documents.
--
-- A cover letter and company profile need the legal name, CIPC registration
-- number, VAT number and an address. None of that lives in data/site.ts (which
-- carries marketing contact details), and it must be editable without a
-- redeploy for the same reason the catalogue moved to D1: Workers have a
-- read-only filesystem.
--
-- Single row, pinned to id = 1 by a CHECK constraint, so there is exactly one
-- company and no way to accidentally create a second.

CREATE TABLE IF NOT EXISTS company_profile (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  legal_name          TEXT NOT NULL DEFAULT '',
  trading_name        TEXT NOT NULL DEFAULT '',
  -- CIPC registration, e.g. "2019/123456/07".
  registration_number TEXT NOT NULL DEFAULT '',
  vat_number          TEXT NOT NULL DEFAULT '',
  physical_address    TEXT NOT NULL DEFAULT '',
  postal_address      TEXT NOT NULL DEFAULT '',
  -- Who signs the bid, and in what capacity — printed on the cover letter's
  -- signature block, since an unsigned cover letter is a wasted page.
  signatory_name      TEXT NOT NULL DEFAULT '',
  signatory_position  TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL DEFAULT '',
  website             TEXT NOT NULL DEFAULT '',
  -- The reusable "about us" paragraphs for the technical proposal.
  profile_text        TEXT NOT NULL DEFAULT '',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The single row always exists, so reads never have to handle "not set up yet"
-- as a separate case from "set up but blank".
INSERT OR IGNORE INTO company_profile (id) VALUES (1);
