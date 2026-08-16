-- Store the actual compliance certificates, and record VAT registration.
--
-- Reverses the earlier metadata-only decision at the user's request: the
-- certificates now live in R2 so the pack can enclose them, rather than being
-- fetched by hand from a separate folder at submission time.
--
-- SECURITY: these are tax documents and company certificates. They are stored
-- under the `documents/` key prefix, which app/img/[...key] refuses to serve
-- (it allows only `products/`), and are readable exclusively through the
-- admin-gated download route. They must never be exposed on a public path.

ALTER TABLE company_documents ADD COLUMN file_key TEXT;
ALTER TABLE company_documents ADD COLUMN file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE company_documents ADD COLUMN file_type TEXT NOT NULL DEFAULT '';
ALTER TABLE company_documents ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0;

-- VAT registration, tracked explicitly rather than inferred from whether a VAT
-- number looks filled in.
--
-- The pricing schedule previously added 15% VAT unconditionally. Skrubb-it is
-- not VAT registered (its stored VAT number is the literal "N/A"), so every
-- generated schedule was quoting VAT that cannot lawfully be charged — a
-- pricing error that can invalidate a bid. Defaulting to 0 makes the safe case
-- the default: a bid never quotes VAT unless registration is confirmed here.
ALTER TABLE company_profile ADD COLUMN vat_registered INTEGER NOT NULL DEFAULT 0;

-- Preserve the intent of any VAT number already captured: a real one implies
-- registration, while blank or "N/A" does not.
UPDATE company_profile
   SET vat_registered = 1
 WHERE TRIM(vat_number) <> ''
   AND UPPER(TRIM(vat_number)) NOT IN ('N/A', 'NA', 'NONE', '-');
