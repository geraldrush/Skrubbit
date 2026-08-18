-- Submission record, and the final mechanical checklist.
--
-- Two related gaps. Nothing recorded what was actually submitted — a bid could
-- be marked "submitted" with no date, no amount and no proof of delivery, which
-- is the record you need when a municipality later says it never arrived. And
-- the steps that get a compliant bid rejected at the box (an unsigned page, an
-- unmarked envelope, a blank field) lived nowhere.

ALTER TABLE tenders ADD COLUMN submitted_at TEXT;
ALTER TABLE tenders ADD COLUMN submitted_by TEXT NOT NULL DEFAULT '';
-- bid_box | courier | hand | portal
ALTER TABLE tenders ADD COLUMN submitted_method TEXT NOT NULL DEFAULT '';
-- The amount actually offered, which may differ from the working pricing
-- schedule if it was adjusted on the day.
ALTER TABLE tenders ADD COLUMN submitted_amount REAL;
-- Courier waybill, bid box receipt number, or portal reference.
ALTER TABLE tenders ADD COLUMN submitted_reference TEXT NOT NULL DEFAULT '';

-- Proof of delivery, stored under the same private `documents/` prefix as the
-- compliance certificates: app/img refuses that prefix, so it is reachable
-- only through the admin-gated download route.
ALTER TABLE tenders ADD COLUMN receipt_file_key TEXT;
ALTER TABLE tenders ADD COLUMN receipt_file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN receipt_file_type TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN receipt_file_size INTEGER NOT NULL DEFAULT 0;

-- The submission checklist, backfilled onto every existing tender.
--
-- These are actions, not returnable documents, so they are inserted with
-- required = 0. That keeps them out of the printed pack's contents page and
-- dividers (both of which take only required rows) and stops them registering
-- as readiness blockers from the day a tender is created, when they are not yet
-- relevant. They are surfaced as their own section in the editor instead.

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'Pack printed in full and every page present', 0, 0, 901
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 901
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'Official MBD/SBD forms completed and inserted behind the matching dividers', 0, 0, 902
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 902
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'Every signature page signed by hand, in black ink', 0, 0, 903
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 903
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'Certified copies enclosed where the tender requires them', 0, 0, 904
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 904
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'All pages numbered', 0, 0, 905
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 905
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'No blank fields anywhere - N/A written where something does not apply', 0, 0, 906
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 906
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'Envelope sealed and marked with the bid number and description', 0, 0, 907
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 907
 );

INSERT INTO tender_items (tender_id, category, label, required, signature_required, position)
SELECT t.id, 'submission', 'Delivered to the tender box or portal, with time to spare', 0, 0, 908
  FROM tenders t
 WHERE NOT EXISTS (
   SELECT 1 FROM tender_items ti
    WHERE ti.tender_id = t.id AND ti.category = 'submission' AND ti.position = 908
 );
