-- Per-tender documents, and evidence links from checklist rows.
--
-- Two gaps. The tender's own paperwork — the advert PDF, the blank official
-- forms, a bill of quantities, proof of attending a briefing, correspondence
-- with the buyer — had nowhere to live, so it stayed in email and download
-- folders while the bid was assembled from memory.
--
-- And a ticked checklist row was only ever a claim. Linking a row to a document
-- in the compliance register turns "attached" into something backed by a file
-- that is actually stored, with an expiry date the readiness check already
-- watches.

CREATE TABLE IF NOT EXISTS tender_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tender_id   INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  -- tender_document | official_forms | boq | briefing_proof | correspondence |
  -- addendum | other
  kind        TEXT NOT NULL DEFAULT 'other',
  label       TEXT NOT NULL DEFAULT '',
  -- R2 object key under the private `documents/` prefix, which app/img refuses
  -- to serve. Reachable only through the admin-gated download route.
  file_key    TEXT NOT NULL,
  file_name   TEXT NOT NULL DEFAULT '',
  file_type   TEXT NOT NULL DEFAULT '',
  file_size   INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tender_files_tender ON tender_files(tender_id, kind);

-- Which company document satisfies a checklist row, when one does. NULL means
-- the row is tracked by hand, which stays valid: plenty of returnables are
-- forms completed on the day rather than certificates on file.
ALTER TABLE tender_items ADD COLUMN document_id INTEGER;
