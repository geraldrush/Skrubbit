-- Order enquiries and contact-form messages.
--
-- Both endpoints previously only console.log'd their payload, which meant an
-- order was lost whenever the customer didn't complete the WhatsApp hand-off,
-- the contact form silently discarded every message, and customer personal
-- information (name, phone, address) ended up in the Workers observability
-- logs with no retention policy. Persisting here makes the records durable and
-- keeps the PII in one place we control.
--
-- Written idempotently to match 0001-0003: this database was provisioned with
-- `d1 execute` rather than `d1 migrations apply`, so migrations may be re-run.

CREATE TABLE IF NOT EXISTS orders (
  -- Human-readable reference already shown to the customer, e.g. "SK-M4TZ01".
  reference        TEXT PRIMARY KEY,
  -- Line items as they were priced at the time of the order. Snapshotted as
  -- JSON rather than joined to variants: prices and SKUs change, and an old
  -- order must keep showing what was actually quoted.
  items            TEXT NOT NULL DEFAULT '[]',
  -- ZAR, recomputed server-side from the stored items so the total always
  -- matches the lines above it.
  subtotal         REAL NOT NULL DEFAULT 0,
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL DEFAULT '',
  customer_email   TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  note             TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Both are only ever read newest-first in the admin console.
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);
