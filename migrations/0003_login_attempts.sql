-- Throttles admin login attempts.
--
-- Workers are stateless, so failed attempts are counted in D1 keyed by client
-- IP. Without this, a single admin password is exposed to unlimited online
-- guessing.

CREATE TABLE IF NOT EXISTS login_attempts (
  ip         TEXT PRIMARY KEY,
  failures   INTEGER NOT NULL DEFAULT 0,
  -- Unix seconds; attempts are refused until this passes.
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
