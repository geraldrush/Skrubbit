import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  createSessionToken,
  getAdminCredential,
  hashPassword,
  sessionCookieHeader,
  setAdminPassword,
} from "@/lib/admin-auth";
import { checkResetToken, consumeResetToken } from "@/lib/admin-reset";

export const dynamic = "force-dynamic";

/**
 * Long, because this is the only credential on the console and it is set once
 * and stored in a password manager rather than typed daily. Nothing here
 * demands mixed case or punctuation: length is what makes a password hard to
 * guess, and composition rules mostly produce predictable substitutions.
 */
const MIN_PASSWORD_LENGTH = 12;

/** Reports whether a link is still good, so the page can say why it isn't. */
export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return Response.json({ ok: false, reason: "invalid" });
  return Response.json(await checkResetToken(env, token));
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();

  let token = "";
  let password = "";
  try {
    const body = (await req.json()) as { token?: unknown; password?: unknown };
    token = typeof body.token === "string" ? body.token : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const check = await checkResetToken(env, token);
  if (!check.ok) {
    const message =
      check.reason === "expired"
        ? "That link has expired. Request a new one."
        : check.reason === "used"
          ? "That link has already been used. Request a new one."
          : "That link is not valid. Request a new one.";
    return Response.json({ error: message }, { status: 400 });
  }

  // Spend the token before writing the password. If the write then fails the
  // admin has to request a fresh link, which is the safe direction: the
  // alternative order leaves a live token behind after a partial success.
  if (!(await consumeResetToken(env, token))) {
    return Response.json(
      { error: "That link has already been used. Request a new one." },
      { status: 400 }
    );
  }

  await setAdminPassword(env, await hashPassword(password));

  // Every existing session is now invalid: the signature covers the password
  // hash, which has just changed. That is the point of a reset — if it was
  // prompted by a suspected compromise, whoever else was signed in is out.
  // Signing the admin straight back in means the reset ends where they want
  // to be rather than at a login form.
  const credential = await getAdminCredential(env);
  if (!credential || !env.ADMIN_SESSION_SECRET) {
    return Response.json({ ok: true, signedIn: false });
  }

  const session = await createSessionToken(
    env.ADMIN_SESSION_SECRET,
    credential.passwordHash
  );
  const secure = new URL(req.url).protocol === "https:";

  // The lockout counter is cleared too: someone who has just proved control of
  // the admin mailbox should not be held out by failures that preceded it.
  await env.DB.prepare("DELETE FROM login_attempts").run();

  return new Response(JSON.stringify({ ok: true, signedIn: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": sessionCookieHeader(session, secure),
    },
  });
}
