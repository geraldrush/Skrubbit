-- Admin credentials and password resets.
--
-- The username and password hash started life as Worker secrets, which works
-- until the admin needs to change the password: a Worker cannot write its own
-- secrets, so a self-service reset is impossible while the credential lives
-- there. Moving it into D1 is what makes "forgot password" possible at all.
--
-- The secrets stay as the bootstrap. lib/admin-auth.ts reads this table first
-- and falls back to ADMIN_USERNAME / ADMIN_PASSWORD_HASH when the row is
-- absent, so the console is reachable before any reset has happened and the
-- initial hash never has to be committed to this file.
CREATE TABLE IF NOT EXISTS admin_credentials (
  -- Exactly one admin, so exactly one row. The CHECK is what enforces that,
  -- rather than a convention nothing verifies.
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  -- pbkdf2$<iterations>$<saltB64>$<hashB64>, same format the secret uses.
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reset tokens.
--
-- Only the SHA-256 of the token is stored. The token itself exists in the
-- emailed link and nowhere else, so a leak of this table hands an attacker
-- nothing usable — the same reason the password is hashed rather than stored.
CREATE TABLE IF NOT EXISTS admin_password_resets (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  -- Set when redeemed. Kept rather than deleted so a link cannot be replayed
  -- and so a second use is distinguishable from an expired one.
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

-- Expiry sweeps and the "is a reset already pending" check both scan by time.
CREATE INDEX IF NOT EXISTS idx_admin_password_resets_expires
  ON admin_password_resets (expires_at);
