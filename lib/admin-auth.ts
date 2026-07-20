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
  /** Interim password auth, used until Cloudflare Access is available. */
  ADMIN_PASSWORD?: string;
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

export async function createSessionToken(secret: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${expiry}.${await hmac(secret, String(expiry))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const [expiryPart, signature] = token.split(".");
  if (!expiryPart || !signature) return false;

  const expiry = Number(expiryPart);
  if (!Number.isSafeInteger(expiry)) return false;

  // Signature is checked before expiry so a tampered cookie fails the same way
  // regardless of the expiry value it claims.
  const expected = await hmac(secret, expiryPart);
  if (!timingSafeEqual(signature, expected)) return false;

  return expiry > Math.floor(Date.now() / 1000);
}

export async function checkPassword(
  supplied: string,
  env: AccessEnv
): Promise<boolean> {
  const actual = env.ADMIN_PASSWORD;
  if (!actual) return false; // fail closed when unset
  return timingSafeEqual(supplied, actual);
}

/** Whether interim password auth is configured and usable. */
export function passwordAuthConfigured(env: AccessEnv): boolean {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET);
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

  // Interim gate: a signed password session. Only consulted when both the
  // password and the signing secret are set, so this stays fail-closed.
  if (passwordAuthConfigured(env)) {
    const session = cookieValue(req, SESSION_COOKIE);
    if (session && (await verifySessionToken(session, env.ADMIN_SESSION_SECRET!))) {
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
