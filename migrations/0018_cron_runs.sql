-- The daily notification run's own record.
--
-- Every other table in the notification path is written only when there is
-- something to say: a reminder that went out (0013), an advert that was
-- announced (0014). A morning with nothing due therefore leaves no trace at
-- all, which makes a quiet day and a dead cron indistinguishable from the
-- inbox. That is the one ambiguity this system cannot afford, because the
-- thing it would be silently failing to mention is a bid deadline.
--
-- So the run records itself here whatever happened, including when it failed.

CREATE TABLE IF NOT EXISTS cron_runs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  -- UTC, as SQLite writes it. The cron fires at 06:00 UTC / 08:00 SAST.
  ran_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Whether the reminders pass itself succeeded. A run that could not send is
  -- not ok even when it returned 200 — see sync_ok for the softer failure.
  ok        INTEGER NOT NULL DEFAULT 1,
  -- The feed poll is allowed to fail without failing the run: a deadline
  -- warning matters more than a fresh advert. Tracked separately so that a
  -- mirror quietly starving for a week is still visible.
  sync_ok   INTEGER NOT NULL DEFAULT 1,
  sent      INTEGER NOT NULL DEFAULT 0,
  announced INTEGER NOT NULL DEFAULT 0,
  failed    INTEGER NOT NULL DEFAULT 0,
  checked   INTEGER NOT NULL DEFAULT 0,
  detail    TEXT    NOT NULL DEFAULT ''
);

-- Every read is "the most recent run", and the pruning delete is by age.
CREATE INDEX IF NOT EXISTS idx_cron_runs_ran_at ON cron_runs(ran_at DESC);
