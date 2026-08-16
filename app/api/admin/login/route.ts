import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  checkPassword,
  createSessionToken,
  passwordAuthConfigured,
  sessionCookieHeader,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** After this many consecutive failures the IP is locked out for a while. */
const MAX_FAILURES = 5;
const LOCKOUT_SECONDS = 15 * 60;
/**
 * Failures stop counting once they are this old, so isolated typos days apart
 * never accumulate into a lockout. Longer than the lockout on purpose: it caps
 * a patient attacker at MAX_FAILURES - 1 guesses per hour from one address.
 */
const FAILURE_WINDOW_SECONDS = 60 * 60;

interface AttemptRecord {
  failures: number;
  locked_until: number;
  updated_at: number;
}

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * How many past failures still count against this address.
 *
 * Reaching the call site means any lockout has already expired. Two things
 * reset the tally, and with neither of them the counter only ever went up:
 *
 *   - A lockout that has been served. Otherwise the stored count stays at
 *     MAX_FAILURES forever, so the very next failure lands back on the
 *     threshold and re-locks — permanently, 15 minutes at a time, locking the
 *     real admin out of their own console over a single typo.
 *   - A quiet period longer than the failure window, so old failures age out.
 */
function carriedFailures(record: AttemptRecord | null, now: number): number {
  if (!record) return 0;
  if (record.locked_until > 0) return 0;
  if (now - record.updated_at > FAILURE_WINDOW_SECONDS) return 0;
  return record.failures;
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();

  if (!passwordAuthConfigured(env)) {
    return Response.json(
      { error: "Admin password sign-in is not configured." },
      { status: 503 }
    );
  }

  const ip = clientIp(req);
  const now = Math.floor(Date.now() / 1000);

  const record = await env.DB.prepare(
    "SELECT failures, locked_until, updated_at FROM login_attempts WHERE ip = ?"
  )
    .bind(ip)
    .first<AttemptRecord>();

  if (record && record.locked_until > now) {
    const mins = Math.ceil((record.locked_until - now) / 60);
    return Response.json(
      { error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await checkPassword(password, env))) {
    const failures = carriedFailures(record, now) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? now + LOCKOUT_SECONDS : 0;
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, failures, locked_until, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET
         failures = excluded.failures,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`
    )
      .bind(ip, failures, lockedUntil, now)
      .run();

    // Deliberately vague: don't confirm whether a password was close.
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  // Success clears the counter so a later typo doesn't inherit old failures.
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();

  const token = await createSessionToken(env.ADMIN_SESSION_SECRET!);
  const secure = new URL(req.url).protocol === "https:";

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionCookieHeader(token, secure),
    },
  });
}
