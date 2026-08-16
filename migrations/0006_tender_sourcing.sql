-- Import tenders from the National Treasury eTenders OCDS API, and price them.
--
-- Skrubb-it bids as a general supplier — government buys goods, we source and
-- deliver them — so tenders are not limited to our own catalogue and pricing
-- lines are free-form rather than drawn from the products table.
--
-- NOTE: unlike 0001-0005 this migration is NOT re-runnable (SQLite has no
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS). That is safe now: the d1_migrations
-- tracking table was populated when 0001-0005 were applied through
-- `migrations apply`, so each file runs exactly once from here on. Re-running
-- it would fail loudly on a duplicate column rather than corrupt anything.

-- Where an imported tender came from, so it can be traced back and not
-- imported twice.
ALTER TABLE tenders ADD COLUMN ocid TEXT;
ALTER TABLE tenders ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN province TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN category TEXT NOT NULL DEFAULT '';
-- The buying department's contact, carried across from the advert so enquiries
-- don't mean digging the PDF out again.
ALTER TABLE tenders ADD COLUMN contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';
ALTER TABLE tenders ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';

-- One import per advertised tender. Partial index so the many manually-created
-- tenders (ocid NULL) don't collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenders_ocid
  ON tenders(ocid) WHERE ocid IS NOT NULL;

-- The pricing schedule behind SBD 3.1/3.2/3.3.
--
-- Deliberately not joined to products/variants: most bids are for goods we
-- resell rather than manufacture, and a line must keep the price that was
-- actually quoted even after the catalogue moves on. A line may be seeded from
-- the catalogue, which is what product_slug records.
CREATE TABLE IF NOT EXISTS tender_pricing (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tender_id    INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  description  TEXT NOT NULL DEFAULT '',
  -- Unit of measure as the tender words it: "each", "5 L", "case of 12".
  unit         TEXT NOT NULL DEFAULT 'each',
  quantity     REAL NOT NULL DEFAULT 1,
  -- What we pay. Never printed on the submitted schedule — it is here so
  -- margin is visible while quoting.
  cost_price   REAL NOT NULL DEFAULT 0,
  -- What we quote, excluding VAT.
  unit_price   REAL NOT NULL DEFAULT 0,
  -- Where the line came from, when seeded from the shop catalogue.
  product_slug TEXT,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tender_pricing_tender
  ON tender_pricing(tender_id, position);
