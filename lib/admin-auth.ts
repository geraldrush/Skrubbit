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
}

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

export async function isAdminRequest(req: Request, env: AccessEnv): Promise<boolean> {
  // Local-only escape hatch, set in .dev.vars. Never set this in production —
  // it disables authentication entirely.
  if (env.ADMIN_DISABLE_ACCESS_CHECK === "1") return true;

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!teamDomain || !aud) return false; // fail closed until configured

  const token =
    req.headers.get("cf-access-jwt-assertion") ??
    // Access also sets this cookie; accept it so direct browser navigation works.
    req.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ??
    null;
  if (!token) return false;

  return (await verifyAccessJwt(token, teamDomain, aud)) !== null;
}

/** Returns a 403 Response when the request is not an authenticated admin. */
export async function requireAdmin(
  req: Request,
  env: AccessEnv
): Promise<Response | null> {
  if (await isAdminRequest(req, env)) return null;
  return new Response(
    JSON.stringify({
      error:
        "Admin access required. Requests must carry a valid Cloudflare Access token.",
    }),
    { status: 403, headers: { "content-type": "application/json" } }
  );
}
