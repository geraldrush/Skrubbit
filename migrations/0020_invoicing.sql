-- Customers, quotes, invoices and payments: the "money in" half of the books.
--
-- Until now an order or a won tender ended at the quote. What the buyer owes,
-- what they have paid and what is late lived nowhere — which also meant there
-- were no figures to put in front of a funder or an accountant.
--
-- Idempotent to match 0001-0019 — this database is provisioned with
-- `d1 execute`, so migrations may be re-run.

CREATE TABLE IF NOT EXISTS customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  -- Who to address it to: "The Station Commander", "Accounts Payable".
  contact_person TEXT NOT NULL DEFAULT '',
  -- Comma-separated. Government buyers often want a copy to two inboxes.
  email          TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  -- The buyer's VAT number. A tax invoice over R5 000 must carry it.
  vat_number     TEXT NOT NULL DEFAULT '',
  -- Days from issue to due. 30 is what government pays on.
  terms_days     INTEGER NOT NULL DEFAULT 30,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Quotes and invoices share one table: a quote becomes an invoice by copying,
-- and both carry the same lines, customer and letterhead.
CREATE TABLE IF NOT EXISTS invoices (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 'invoice' | 'quote'
  kind             TEXT NOT NULL DEFAULT 'invoice',
  -- Assigned at issue, never at draft. SARS expects invoice numbers to run
  -- without gaps, and a draft that is deleted must not burn one.
  number           TEXT UNIQUE,
  -- 'draft' | 'issued' | 'void'. Paid / part-paid / overdue are derived from
  -- the payments and the due date, so they can never disagree with them.
  status           TEXT NOT NULL DEFAULT 'draft',
  customer_id      INTEGER REFERENCES customers(id),
  -- The customer as they stood when the document was issued. Editing a
  -- customer's address later must not rewrite an invoice already sent.
  customer_name    TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  customer_email   TEXT NOT NULL DEFAULT '',
  customer_vat     TEXT NOT NULL DEFAULT '',
  -- Plain dates (YYYY-MM-DD). For a quote, due_on is "valid until".
  issued_on        TEXT,
  due_on           TEXT,
  -- The buyer's order or PO number. Government will not pay an invoice
  -- that does not quote it.
  reference        TEXT NOT NULL DEFAULT '',
  notes            TEXT NOT NULL DEFAULT '',
  -- Fixed at issue from the company profile: 0 while not VAT-registered.
  vat_rate         REAL NOT NULL DEFAULT 0,
  -- Where it came from, so the tender or order can link back to it.
  tender_id        INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
  order_reference  TEXT,
  -- The quote this invoice was raised from.
  quote_id         INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  emailed_at       TEXT,
  emailed_to       TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'each',
  quantity    REAL NOT NULL DEFAULT 1,
  -- ZAR excluding VAT, to match tender_pricing.
  unit_price  REAL NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  received_on TEXT NOT NULL,
  amount      REAL NOT NULL,
  -- eft | cash | card | other
  method      TEXT NOT NULL DEFAULT 'eft',
  -- The bank statement reference, so a payment can be found again.
  reference   TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The next number for each sequence. A row per kind so quotes (Q-0001) and
-- invoices (INV-0001) count independently.
CREATE TABLE IF NOT EXISTS number_sequences (
  name TEXT PRIMARY KEY,
  next INTEGER NOT NULL
);
INSERT OR IGNORE INTO number_sequences (name, next) VALUES ('invoice', 1);
INSERT OR IGNORE INTO number_sequences (name, next) VALUES ('quote', 1);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tender ON invoices(tender_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
