-- Alerts for newly advertised tenders in the provinces worth watching.
--
-- The deadline reminders in 0013 only cover tenders already in the register —
-- bids we know about. This covers the opposite problem: an advert appearing on
-- eTenders that nobody has seen yet. A tender is only worth knowing about while
-- it is open, and the good ones close fast, so "check the search page now and
-- then" loses bids.
--
-- Two things are needed that the mirror did not record.

-- 1. When the tender was ADVERTISED, from the OCDS release date. `synced_at` is
--    useless for this: it is rewritten on every upsert, so it says when we last
--    refreshed the row, not when the tender appeared. Advert date is also what
--    survives an incomplete crawl — a tender first mirrored today because the
--    crawl only just reached its page is not new, and dating it by first sight
--    would announce a month of backlog as fresh news.
ALTER TABLE remote_tenders ADD COLUMN published_at TEXT;

CREATE INDEX IF NOT EXISTS idx_remote_published ON remote_tenders(published_at);

-- 2. Which adverts have already been announced. The alert has no other way to
--    be idempotent: the digest runs daily over a rolling window, so without
--    this every tender in the window would be announced again every morning.
--    Kept by ocid, and deliberately NOT cleaned up when a tender is deleted
--    from the mirror — a row here is a record that we told you, and re-adding
--    a tender that closed and reopened should not re-announce it.
CREATE TABLE IF NOT EXISTS remote_tender_alerts (
  ocid      TEXT PRIMARY KEY,
  sent_at   TEXT NOT NULL DEFAULT (datetime('now')),
  recipient TEXT NOT NULL DEFAULT '',
  ok        INTEGER NOT NULL DEFAULT 1,
  detail    TEXT NOT NULL DEFAULT ''
);

-- Which provinces to watch, comma-separated. Limpopo by default: the business
-- is based there and delivers nationally only by arrangement, so a national
-- feed of every advert would be noise rather than an alert.
ALTER TABLE company_profile ADD COLUMN alert_provinces TEXT NOT NULL DEFAULT 'Limpopo';
