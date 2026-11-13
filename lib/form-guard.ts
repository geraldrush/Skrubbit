/**
 * Abuse protection for the public, unauthenticated form endpoints
 * (`/api/orders` and `/api/contact`).
 *
 * Two layers, checked cheapest first:
 *   1. A per-IP rate limit through the Workers Rate Limiting binding. It runs
 *      at the edge with no database write, so a flood is turned away before it
 *      costs a D1 row or an email.
 *   2. Cloudflare Turnstile, verified server-side. Like the admin sign-in, it
 *      is inert until `TURNSTILE_SECRET_KEY` is set, so the widget and the
 *      secret can be rolled out separately without breaking the forms.
 *
 * Both fail open when their binding or secret is missing (local dev, a deploy
 * made before the binding existed). These forms are how customers reach the
 * business, and a protection that silently blocks every real order is worse
 * than the spam it prevents.
 */

import { verifyTurnstile, type TurnstileEnv } from "@/lib/turnstile";

export interface FormGuardEnv extends TurnstileEnv {
  /** `ratelimits` binding in wrangler.jsonc. */
  FORM_LIMITER?: RateLimit;
}

export interface GuardRejection {
  status: 403 | 429;
  error: string;
}

/** The visitor's address as Cloudflare saw it. Never trusted from the client. */
function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Returns null when the request may proceed, or the status and message to
 * answer with. `scope` keeps the order and contact limits separate, so a
 * customer who sends a message can still place an order.
 */
export async function guardPublicForm(
  req: Request,
  env: FormGuardEnv,
  scope: "orders" | "contact",
  turnstileToken: unknown
): Promise<GuardRejection | null> {
  if (env.FORM_LIMITER) {
    try {
      const { success } = await env.FORM_LIMITER.limit({ key: `${scope}:${clientIp(req)}` });
      if (!success) {
        return {
          status: 429,
          error: "Too many submissions from your connection. Please wait a minute and try again.",
        };
      }
    } catch (err) {
      // A limiter outage must not take the order form down with it.
      console.error(`[${scope}] rate limiter unavailable`, err);
    }
  }

  const token = typeof turnstileToken === "string" ? turnstileToken : "";
  const check = await verifyTurnstile(req, token, env);
  if (!check.ok) {
    console.warn(`[${scope}] turnstile rejected: ${check.detail}`);
    return {
      status: 403,
      error: "We couldn't confirm you're not a bot. Please complete the check and try again.",
    };
  }

  return null;
}
