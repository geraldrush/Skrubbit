-- Certification tracking, and the written technical sections of a bid.
--
-- Certification is an external act: a Commissioner of Oaths sees the original
-- and stamps the copy. Nothing here certifies anything. These columns record
-- which documents *need* certifying and when each was last done, so the pack
-- can mark the copies to take for certification and warn when one has gone
-- stale — most tenders want a certified copy no older than 3-6 months.

ALTER TABLE company_documents ADD COLUMN requires_certification INTEGER NOT NULL DEFAULT 0;
-- Date the copy was certified by a Commissioner of Oaths, or NULL if never.
ALTER TABLE company_documents ADD COLUMN certified_on TEXT;

-- Certified ID copies and CIPC registration documents are the two the
-- checklist always demands certified, so default those on.
UPDATE company_documents
   SET requires_certification = 1
 WHERE kind IN ('id_copy', 'cipc');

-- The written technical proposal. Per-tender rather than company-level: the
-- guide is explicit that the company profile should be tailored to the tender,
-- and methodology only means anything against a specific scope of work.
ALTER TABLE tenders ADD COLUMN profile_override TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN methodology TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN experience TEXT NOT NULL DEFAULT '';
