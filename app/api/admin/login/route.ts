import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  checkCredentials,
  createSessionToken,
  getAdminCredential,
  sessionCookieHeader,
} from "@/lib/admin-auth";
import { verifyTurnstile } from "@/lib/turnstile";

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

  const credential = await getAdminCredential(env);
  if (!credential || !env.ADMIN_SESSION_SECRET) {
    return Response.json(
      { error: "Admin sign-in is not configured." },
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

  let username = "";
  let password = "";
  let turnstileToken = "";
  try {
    const body = (await req.json()) as {
      username?: unknown;
      password?: unknown;
      turnstileToken?: unknown;
    };
    username = typeof body.username === "string" ? body.username : "";
    password = typeof body.password === "string" ? body.password : "";
    turnstileToken =
      typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Checked before the credentials, so a script that cannot solve the
  // challenge never reaches the password comparison at all — and never spends
  // a lockout slot that belongs to the real admin.
  const verified = await verifyTurnstile(req, turnstileToken, env);
  if (!verified.ok) {
    return Response.json(
      { error: "Verification failed. Complete the challenge and try again." },
      { status: 403 }
    );
  }

  if (!(await checkCredentials(username, password, env))) {
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

    // Deliberately vague: one message for a wrong username and a wrong
    // password alike, so the response never confirms that an account exists.
    return Response.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  // Success clears the counter so a later typo doesn't inherit old failures.
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();

  const token = await createSessionToken(
    env.ADMIN_SESSION_SECRET,
    credential.passwordHash
  );
  const secure = new URL(req.url).protocol === "https:";

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionCookieHeader(token, secure),
    },
  });
}
