-- Product catalogue. Replaces the hardcoded array that used to live in
-- data/products.ts, so products can be added from /admin without a redeploy.
--
-- Categories deliberately stay in code (data/products.ts): they are a fixed
-- taxonomy tied to the CategoryId union type, not user-editable content.

CREATE TABLE IF NOT EXISTS products (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  image       TEXT NOT NULL DEFAULT '',
  featured    INTEGER NOT NULL DEFAULT 0,
  -- JSON arrays of plain strings; no querying needed, so no separate tables.
  scents      TEXT NOT NULL DEFAULT '[]',
  usage       TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS variants (
  sku          TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  size         TEXT NOT NULL,
  -- ZAR. REAL matches the existing prices (e.g. 32.9) rather than cents.
  price        REAL NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
