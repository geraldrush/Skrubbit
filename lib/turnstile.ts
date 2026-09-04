/**
 * Cloudflare Turnstile verification.
 *
 * Always server-side. The token the browser receives proves nothing until it
 * has been exchanged at siteverify with the secret key, and that exchange can
 * only happen somewhere the secret lives — so a token checked in the browser,
 * or trusted because the client said it was fine, is not a check at all.
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileEnv {
  /** Set with `wrangler secret put TURNSTILE_SECRET_KEY`. */
  TURNSTILE_SECRET_KEY?: string;
}

export interface TurnstileResult {
  ok: boolean;
  /** Populated on failure, for logs. Never shown to the visitor. */
  detail: string;
}

/**
 * Verifies a widget token.
 *
 * Inert until `TURNSTILE_SECRET_KEY` is set, and this is deliberate. The site
 * key is compiled into the browser bundle at build time, so the widget and the
 * secret cannot land in the same instant; if an unset secret rejected every
 * token, configuring Turnstile would mean locking the admin out of their own
 * console in the window between the two. The password is the gate that must
 * always hold — Turnstile is there to keep automated guessing away from it.
 *
 * Once the secret is set this fails closed: a missing, malformed or rejected
 * token is refused.
 */
export async function verifyTurnstile(
  req: Request,
  token: string,
  env: TurnstileEnv
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, detail: "TURNSTILE_SECRET_KEY not set; skipped" };

  if (!token) return { ok: false, detail: "no token supplied" };

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  // Binds the token to the address that solved it, so a token harvested from
  // one browser cannot be replayed from somewhere else.
  const ip = req.headers.get("cf-connecting-ip");
  if (ip) body.append("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, detail: `siteverify ${res.status}` };

    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success === true) return { ok: true, detail: "" };
    return { ok: false, detail: (data["error-codes"] ?? ["unknown"]).join(",") };
  } catch (err) {
    // A network failure reaching Cloudflare is not proof the caller is a bot,
    // but it is also not proof they are not. This is the admin login, so it
    // refuses — the admin can retry, and an outage here must not become an
    // open door.
    return { ok: false, detail: String(err).slice(0, 200) };
  }
}
