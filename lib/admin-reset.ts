/**
 * Password reset tokens for the admin console.
 *
 * A token is 32 random bytes, hex-encoded, handed out once in an emailed link.
 * Only its SHA-256 is stored, for the same reason the password is hashed: this
 * table is not a set of usable keys if it leaks.
 *
 * Single-use and short-lived. Redeeming marks the row rather than deleting it,
 * so a replayed link is refused as used rather than silently treated as one
 * that never existed.
 */

const TOKEN_TTL_SECONDS = 60 * 60; // one hour

export interface ResetEnv {
  DB?: D1Database;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of the token, hex. The only form that touches the database. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return toHex(new Uint8Array(digest));
}

/**
 * Mints a token and records its hash.
 *
 * Any outstanding tokens are dropped first, so asking for a second link
 * silently invalidates the first. Two live links would mean a stale email in
 * an inbox stays dangerous for an hour after the admin has already used a
 * newer one.
 */
export async function createResetToken(env: ResetEnv): Promise<string> {
  if (!env.DB) throw new Error("No database binding");

  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_password_resets WHERE used_at IS NULL"),
    env.DB.prepare(
      `INSERT INTO admin_password_resets (token_hash, expires_at, used_at, created_at)
       VALUES (?, ?, NULL, ?)`
    ).bind(await hashToken(token), now + TOKEN_TTL_SECONDS, now),
  ]);

  return token;
}

export type ResetCheck =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Whether this token can still be redeemed.
 *
 * The reasons are distinguished for the admin's benefit — "that link has
 * expired" is actionable where "invalid" is not — and it gives an attacker
 * nothing, since they cannot produce a token to ask about in the first place.
 */
export async function checkResetToken(
  env: ResetEnv,
  token: string
): Promise<ResetCheck> {
  if (!env.DB) return { ok: false, reason: "invalid" };

  const row = await env.DB.prepare(
    "SELECT expires_at, used_at FROM admin_password_resets WHERE token_hash = ?"
  )
    .bind(await hashToken(token))
    .first<{ expires_at: number; used_at: number | null }>();

  if (!row) return { ok: false, reason: "invalid" };
  if (row.used_at !== null) return { ok: false, reason: "used" };
  if (row.expires_at <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

/**
 * Marks a token spent.
 *
 * The `used_at IS NULL` guard is what makes redemption single-use even if two
 * requests arrive together: the second updates no rows and is refused.
 */
export async function consumeResetToken(
  env: ResetEnv,
  token: string
): Promise<boolean> {
  if (!env.DB) return false;
  const result = await env.DB.prepare(
    "UPDATE admin_password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL"
  )
    .bind(Math.floor(Date.now() / 1000), await hashToken(token))
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
