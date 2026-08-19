-- The company profile as editable fields, not one free-text box.
--
-- profile_text already held a single paragraph for the tender pack. A profile
-- a buyer will actually read needs more than that — who we are, why local, what
-- we can honestly produce, and who will vouch for us — and every one of those
-- has to be editable without a redeploy, because they change as the business
-- changes and they are what a supplier database asks for.
--
-- Registration particulars live here too rather than being typed into each
-- document. They are copied from CIPC, SARS, CSD and the B-BBEE affidavit, and
-- a mismatch between them and those records is a standard reason for a
-- submission to be set aside.

ALTER TABLE company_profile ADD COLUMN annual_turnover TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN tax_number TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN csd_number TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN bbbee_status TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN bank_details TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN profile_local TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN profile_capacity TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN profile_made TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN profile_sourced TEXT NOT NULL DEFAULT '';
ALTER TABLE company_profile ADD COLUMN profile_references TEXT NOT NULL DEFAULT '';
