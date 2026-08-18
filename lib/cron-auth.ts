/**
 * Authentication for the cron endpoints.
 *
 * They can't sit behind the admin session — a scheduled worker has no cookie —
 * so they authenticate on a shared secret instead. Without CRON_SECRET set they
 * refuse outright rather than running open: a missing secret must fail closed,
 * not expose a send loop or a feed crawl to the internet.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** Returns a response to send back when the caller is not the cron, or null
 *  when it is. */
export function requireCron(
  req: Request,
  env: { CRON_SECRET?: string }
): Response | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Scheduled jobs are not configured (CRON_SECRET unset)." },
      { status: 503 }
    );
  }

  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-cron-secret") ??
    "";
  return timingSafeEqual(supplied, secret)
    ? null
    : Response.json({ error: "Forbidden" }, { status: 403 });
}
