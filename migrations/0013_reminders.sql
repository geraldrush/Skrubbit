-- Deadline reminders.
--
-- The app has no scheduler of its own: the eTenders sync piggybacks on page
-- visits, which is fine for topping up a mirror and useless for reminders —
-- the whole point is reaching you when you have NOT opened the app. A separate
-- Cloudflare cron worker calls /api/cron/reminders daily; this table is what
-- stops it sending the same warning every day after that.

CREATE TABLE IF NOT EXISTS tender_reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tender_id  INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  -- briefing | closing_7d | closing_48h | closing_24h
  kind       TEXT NOT NULL,
  sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
  -- Kept for diagnosis when a reminder did not arrive.
  recipient  TEXT NOT NULL DEFAULT '',
  ok         INTEGER NOT NULL DEFAULT 1,
  detail     TEXT NOT NULL DEFAULT ''
);

-- One reminder of each kind per tender, enforced rather than assumed: a cron
-- that fires twice, or a retry after a partial failure, must not re-send.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tender_reminders_once
  ON tender_reminders(tender_id, kind);

-- Where alerts go. Deliberately separate from company_profile.email, which is
-- the business address printed on the bid documents — that is often a shared
-- inbox nobody watches, and a deadline warning needs to reach a person.
ALTER TABLE company_profile ADD COLUMN notify_email TEXT NOT NULL DEFAULT '';
