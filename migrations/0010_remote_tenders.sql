-- A local mirror of the National Treasury eTenders feed.
--
-- Two problems forced this. The feed returns variable, short pages (47, 51,
-- 39, 54, 34 records against a requested 100), so "fewer than asked for" does
-- not mean "last page" and a naive crawl stops after page one. And it is slow
-- and unreliable — measured 43s on a good page, 120s timeouts on others, and
-- outright refusal when pages are fetched concurrently — so it cannot be
-- crawled live while someone waits for a search.
--
-- Mirroring it fixes both: the crawl happens in the background and can afford
-- to be slow, while searching is a local D1 query that is instant and complete.
--
-- Rows are kept by CLOSING date, not advertising date: a tender advertised
-- months ago but closing next week is still open and must appear.

CREATE TABLE IF NOT EXISTS remote_tenders (
  ocid                TEXT PRIMARY KEY,
  reference           TEXT NOT NULL DEFAULT '',
  title               TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  department          TEXT NOT NULL DEFAULT '',
  -- ISO-8601 with an explicit +02:00 offset. The feed stamps SAST wall-clock
  -- times with `Z`; they are corrected on the way in (see lib/etenders.ts).
  closing_at          TEXT,
  briefing_at         TEXT,
  briefing_compulsory INTEGER NOT NULL DEFAULT 0,
  briefing_venue      TEXT NOT NULL DEFAULT '',
  province            TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL DEFAULT '',
  delivery_location   TEXT NOT NULL DEFAULT '',
  value_amount        REAL NOT NULL DEFAULT 0,
  contact_name        TEXT NOT NULL DEFAULT '',
  contact_email       TEXT NOT NULL DEFAULT '',
  contact_phone       TEXT NOT NULL DEFAULT '',
  document_url        TEXT NOT NULL DEFAULT '',
  -- Lowercased title + description + department, so keyword search is one
  -- LIKE against a single column instead of three.
  search_text         TEXT NOT NULL DEFAULT '',
  synced_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_remote_closing ON remote_tenders(closing_at);
CREATE INDEX IF NOT EXISTS idx_remote_province ON remote_tenders(province);
CREATE INDEX IF NOT EXISTS idx_remote_category ON remote_tenders(category);

-- Progress of the background crawl.
--
-- next_page is a resumable cursor: a run walks a bounded number of pages so it
-- fits comfortably inside a request's lifetime, then the following run picks up
-- where it stopped. Reaching an empty page completes a sweep and resets to 1.
CREATE TABLE IF NOT EXISTS sync_state (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  next_page      INTEGER NOT NULL DEFAULT 1,
  -- Consecutive failed attempts at next_page. The feed times out often, so a
  -- failed page is retried on the following run rather than skipped — but a
  -- permanently broken one must not wedge the crawl, hence the counter.
  page_attempts  INTEGER NOT NULL DEFAULT 0,
  running        INTEGER NOT NULL DEFAULT 0,
  -- Guards against a crashed run leaving `running` stuck on forever.
  started_at     TEXT,
  last_run_at    TEXT,
  -- When a full pass over every page last completed.
  last_sweep_at  TEXT,
  pages_last_run INTEGER NOT NULL DEFAULT 0,
  records_total  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'never',
  message        TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO sync_state (id) VALUES (1);
