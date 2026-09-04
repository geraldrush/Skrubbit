/**
 * Admin access guard — verifies Cloudflare Access JWTs.
 *
 * IMPORTANT: an earlier version of this file only checked that the
 * Cf-Access-Jwt-Assertion header was *present*. That was trivially bypassable
 * — any client can set that header, and Cloudflare does not strip it — so the
 * admin write endpoints were effectively public. The token must be verified
 * cryptographically, which is what this file now does.
 *
 * Verification steps (all required):
 *   1. RS256 signature against the team's published JWKS
 *   2. `aud` matches this application's Access audience tag
 *   3. `iss` matches the team domain
 *   4. `exp` / `nbf` are within tolerance
 *
 * Fails closed: if ACCESS_TEAM_DOMAIN or ACCESS_AUD are unset, no request is
 * ever treated as admin.
 */

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_DISABLE_ACCESS_CHECK?: string;
  /**
   * Where the live credential is kept once the admin has set a password.
   *
   * A Worker cannot write its own secrets, so the pair below can only ever be
   * the bootstrap: with the credential in the environment there is no way to
   * change it from inside the app, and no reset flow is possible. The row in
   * `admin_credentials` takes precedence when it exists.
   */
  DB?: D1Database;
  /** The single admin's username. An email address, in practice. */
  ADMIN_USERNAME?: string;
  /**
   * The admin password as `pbkdf2$<iterations>$<saltB64>$<hashB64>`, never as
   * the password itself.
   *
   * Stored hashed so that account access is not password access: anyone who
   * can read the Worker's secrets in the dashboard — or a leaked backup of
   * them — still cannot sign in as the admin or try the password anywhere
   * else. Nobody, including whoever set it, can read it back out.
   */
  ADMIN_PASSWORD_HASH?: string;
  /** HMAC key for signing admin session cookies. */
  ADMIN_SESSION_SECRET?: string;
}

export const SESSION_COOKIE = "skrubbit_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** JWKS rarely rotates; cache per isolate to avoid a fetch on every request. */
let jwksCache: { teamDomain: string; keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  // Backed by a plain ArrayBuffer so it satisfies BufferSource for WebCrypto.
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys(teamDomain: string): Promise<Jwk[]> {
  const fresh =
    jwksCache &&
    jwksCache.teamDomain === teamDomain &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh) return jwksCache!.keys;

  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Could not fetch Access JWKS (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

/**
 * Returns the verified subject (user identity) or null.
 *
 * Any failure — malformed token, unknown key, bad signature, wrong audience,
 * expired — returns null rather than throwing, so callers treat it uniformly
 * as "not an admin".
 */
export async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  aud: string
): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64))) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== "RS256" || !header.kid) return null;

    const jwk = (await getKeys(teamDomain)).find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(signatureB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as {
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
      email?: string;
      sub?: string;
    };

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(aud)) return null;
    if (payload.iss !== `https://${teamDomain}`) return null;

    const now = Math.floor(Date.now() / 1000);
    const skew = 60;
    if (typeof payload.exp === "number" && payload.exp + skew < now) return null;
    if (typeof payload.nbf === "number" && payload.nbf - skew > now) return null;

    return payload.email ?? payload.sub ?? "unknown";
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Interim password auth
 *
 * Used only until skrubbit.co.za is active and Cloudflare Access can front
 * /admin. Access remains the preferred gate — this exists so products can be
 * loaded before the domain is delegated.
 *
 * Session cookie format: `<expiryEpochSeconds>.<hmacSha256(expiry)>`
 * The cookie carries no identity because there is exactly one admin; the
 * signature is what makes it unforgeable, and the embedded expiry is covered
 * by that signature so it cannot be extended by editing the cookie.
 * ------------------------------------------------------------------ */

/** Rejects short-circuit timing differences on both password and signature. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // Compare lengths without returning early, then fold length equality in.
  let diff = ab.length ^ bb.length;
  const max = Math.max(ab.length, bb.length);
  for (let i = 0; i < max; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The current password hash is folded into the signature, so changing the
 * password invalidates every session that exists.
 *
 * Without this a password reset would leave whoever prompted it still signed
 * in for up to twelve hours — which defeats the point of resetting after a
 * suspected compromise. It costs nothing: the hash is already loaded to check
 * the credential, and it never leaves the server.
 */
function sessionMessage(expiry: number | string, passwordHash: string): string {
  return `${expiry}:${passwordHash}`;
}

export async function createSessionToken(
  secret: string,
  passwordHash: string
): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${expiry}.${await hmac(secret, sessionMessage(expiry, passwordHash))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  passwordHash: string
): Promise<boolean> {
  const [expiryPart, signature] = token.split(".");
  if (!expiryPart || !signature) return false;

  const expiry = Number(expiryPart);
  if (!Number.isSafeInteger(expiry)) return false;

  // Signature is checked before expiry so a tampered cookie fails the same way
  // regardless of the expiry value it claims.
  const expected = await hmac(secret, sessionMessage(expiryPart, passwordHash));
  if (!timingSafeEqual(signature, expected)) return false;

  return expiry > Math.floor(Date.now() / 1000);
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * PBKDF2-SHA256. Deliberately slow, so that a stolen hash cannot be attacked
 * at the speed a bare SHA-256 would allow.
 *
 * 210,000 iterations is OWASP's current floor for PBKDF2-HMAC-SHA256. It costs
 * a fraction of a second once per sign-in, against a 12-hour session, so the
 * admin never notices it — and the login route's lockout means an attacker
 * never gets to run it often enough to matter either.
 */
async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

/**
 * The work factor for newly set passwords.
 *
 * Well below OWASP's 210,000 floor for PBKDF2-SHA256, and deliberately so: the
 * derivation runs inside a Worker, where CPU per request is metered and a
 * quarter-second of it on every sign-in is already generous. 210,000 measured
 * at roughly three quarters of a second, which risks the request being cut off
 * — and a login that cannot complete is worse than one with a smaller margin
 * against offline cracking.
 *
 * What actually protects this credential is its length. The password issued
 * with this feature is 28 random characters (~160 bits), which no work factor
 * meaningfully improves, because no amount of hardware brute-forces it. That
 * bargain only holds while the password stays long — which is why the reset
 * form sets a floor rather than offering a strength meter.
 *
 * Verification reads the count from the stored hash rather than from here, so
 * raising this later re-hashes on the next password change without stranding
 * the existing one.
 */
const HASH_ITERATIONS = 25_000;

/**
 * Formats a password for storage, in the format both the bootstrap secret and
 * the `admin_credentials` row use.
 *
 * Exported so the hash can be produced by a script rather than by hand, and so
 * the format has exactly one definition that the generator, the reset flow and
 * the verifier all read from.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, HASH_ITERATIONS);
  return `pbkdf2$${HASH_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

export interface AdminCredential {
  username: string;
  passwordHash: string;
}

/**
 * The live credential: the `admin_credentials` row if one exists, otherwise
 * the bootstrap secrets.
 *
 * The row wins because it is the only half that can be rewritten at runtime.
 * Once a reset has been completed the secrets are inert, and can be deleted.
 *
 * Returns null when neither is configured, which every caller treats as "no
 * admin", so an unconfigured deployment is locked rather than open.
 */
export async function getAdminCredential(
  env: AccessEnv
): Promise<AdminCredential | null> {
  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        "SELECT username, password_hash FROM admin_credentials WHERE id = 1"
      ).first<{ username: string; password_hash: string }>();
      if (row?.username && row.password_hash) {
        return { username: row.username, passwordHash: row.password_hash };
      }
    } catch (error) {
      // A missing table means the migration has not run yet, which is a normal
      // state on a first deploy — fall through to the bootstrap rather than
      // locking the admin out of the console that would let them fix it.
      console.error("admin_credentials read failed; using bootstrap", error);
    }
  }

  if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD_HASH) {
    return { username: env.ADMIN_USERNAME, passwordHash: env.ADMIN_PASSWORD_HASH };
  }
  return null;
}

/**
 * Replaces the stored password, moving the credential into D1 the first time.
 *
 * The username comes from the existing credential rather than from the caller:
 * a reset changes the password and nothing else, so a stolen reset link cannot
 * also change who the admin is.
 */
export async function setAdminPassword(
  env: AccessEnv,
  passwordHash: string
): Promise<void> {
  if (!env.DB) throw new Error("No database binding; cannot store a password");
  const current = await getAdminCredential(env);
  if (!current) throw new Error("No admin configured");

  await env.DB.prepare(
    `INSERT INTO admin_credentials (id, username, password_hash, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       password_hash = excluded.password_hash,
       updated_at = excluded.updated_at`
  )
    .bind(current.username, passwordHash)
    .run();
}

/**
 * Whether these credentials match the configured admin.
 *
 * Both halves are compared in constant time, and the password is derived even
 * when the username is already wrong, so the response time does not reveal
 * which half failed.
 */
export async function checkCredentials(
  suppliedUsername: string,
  suppliedPassword: string,
  env: AccessEnv
): Promise<boolean> {
  const credential = await getAdminCredential(env);
  if (!credential) return false; // fail closed when unset
  const { username, passwordHash: stored } = credential;

  // Usernames are email addresses, whose local part is technically
  // case-sensitive but never treated that way by any provider in practice.
  // Case-folding here avoids locking the admin out over a capital letter.
  const usernameOk = timingSafeEqual(
    suppliedUsername.trim().toLowerCase(),
    username.trim().toLowerCase()
  );

  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 1) return false;

  const salt = b64urlToBytes(parts[2]);
  const expected = parts[3];
  const actual = bytesToB64(await pbkdf2(suppliedPassword, salt, iterations));

  const passwordOk = timingSafeEqual(actual, expected);
  return usernameOk && passwordOk;
}

/** Whether username + password sign-in is configured and usable. */
export async function passwordAuthConfigured(env: AccessEnv): Promise<boolean> {
  if (!env.ADMIN_SESSION_SECRET) return false;
  return (await getAdminCredential(env)) !== null;
}

function cookieValue(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token: string, secure = true): string {
  // HttpOnly: unreadable from JS, so an XSS bug can't exfiltrate the session.
  // SameSite=Lax: survives top-level navigation to /admin but not cross-site
  // form posts, which blocks CSRF against the admin write endpoints.
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookieHeader(secure = true): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function isAdminRequest(req: Request, env: AccessEnv): Promise<boolean> {
  // Local-only escape hatch, set in .dev.vars. Never set this in production —
  // it disables authentication entirely.
  if (env.ADMIN_DISABLE_ACCESS_CHECK === "1") return true;

  // Preferred gate: a Cloudflare Access token, when Access is configured.
  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (teamDomain && aud) {
    const token =
      req.headers.get("cf-access-jwt-assertion") ??
      // Access also sets this cookie; accept it so direct navigation works.
      req.headers.get("cookie")?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ??
      null;
    if (token && (await verifyAccessJwt(token, teamDomain, aud))) return true;
  }

  // Username + password session. Only consulted when both a credential and the
  // signing secret exist, so this stays fail-closed.
  const credential = env.ADMIN_SESSION_SECRET ? await getAdminCredential(env) : null;
  if (credential) {
    const session = cookieValue(req, SESSION_COOKIE);
    if (
      session &&
      (await verifySessionToken(
        session,
        env.ADMIN_SESSION_SECRET!,
        credential.passwordHash
      ))
    ) {
      return true;
    }
  }

  return false;
}

/** Returns a 403 Response when the request is not an authenticated admin. */
export async function requireAdmin(
  req: Request,
  env: AccessEnv
): Promise<Response | null> {
  if (await isAdminRequest(req, env)) return null;
  return new Response(
    JSON.stringify({
      error: "Admin access required. Sign in at /admin.",
    }),
    { status: 403, headers: { "content-type": "application/json" } }
  );
}
