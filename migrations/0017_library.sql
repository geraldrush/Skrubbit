-- The reference library: documents the business works from.
--
-- Deliberately NOT company_documents. That table is the compliance matrix —
-- certificates with issue and expiry dates — and lib/pack-pdf.ts prints every
-- row of it into the "Schedule of enclosed documents" and appends the files to
-- the tender pack. Putting the formulation books there would post the recipes
-- to a buyer inside a bid. They are the business.
--
-- These are internal working papers: technical data sheets to send with a
-- quotation, formulation books, supplier price lists. Never public, never
-- automatically enclosed in anything.

CREATE TABLE IF NOT EXISTS library_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  -- datasheet | formulation | pricelist | other
  category    TEXT NOT NULL DEFAULT 'other',
  notes       TEXT NOT NULL DEFAULT '',
  -- Trade secrets. Flagged so the admin cannot mistake a formulation book for
  -- something that may be attached to a quotation.
  confidential INTEGER NOT NULL DEFAULT 0,
  file_key    TEXT NOT NULL,
  file_name   TEXT NOT NULL DEFAULT '',
  file_type   TEXT NOT NULL DEFAULT '',
  file_size   INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_library_category ON library_documents(category, title);
