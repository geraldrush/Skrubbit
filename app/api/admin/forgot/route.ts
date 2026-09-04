import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getAdminCredential } from "@/lib/admin-auth";
import { createResetToken } from "@/lib/admin-reset";
import { emailConfigured, sendEmail } from "@/lib/notify";
import { site } from "@/data/site";

export const dynamic = "force-dynamic";

/**
 * Sending is throttled per address rather than per attempt, because the cost
 * being controlled here is mail sent to the admin's inbox — a bot hammering
 * this endpoint should not be able to bury a real reset link under fifty
 * others, or get the sender domain marked as spam.
 */
const MIN_SECONDS_BETWEEN_SENDS = 2 * 60;

function baseUrl(req: Request): string {
  // The canonical host, not the request's: the link is going into an email and
  // has to work when clicked from anywhere, and Host is attacker-controlled.
  // Sending a reset link to a host from the request would let someone mint a
  // link that points at their own server and post the token back to it.
  return site.url.replace(/\/$/, "");
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();

  let username = "";
  try {
    const body = (await req.json()) as { username?: unknown };
    username = typeof body.username === "string" ? body.username : "";
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // One response for every outcome below. Whether that address is the admin's,
  // whether email is configured, whether a send failed — none of it is
  // distinguishable from outside, so this endpoint cannot be used to discover
  // the admin's address or to probe the system's state.
  const accepted = Response.json({
    ok: true,
    message: "If that address belongs to the admin, a reset link is on its way.",
  });

  const credential = await getAdminCredential(env);
  if (!credential) return accepted;

  if (
    username.trim().toLowerCase() !== credential.username.trim().toLowerCase()
  ) {
    return accepted;
  }

  if (!emailConfigured(env)) {
    // Worth a log: from outside this is indistinguishable from success, so
    // without this line a misconfigured sender would look like a silent
    // delivery failure and be very hard to diagnose.
    console.error("admin password reset requested but email is not configured");
    return accepted;
  }

  const recent = await env.DB.prepare(
    `SELECT created_at FROM admin_password_resets
      WHERE used_at IS NULL
      ORDER BY created_at DESC LIMIT 1`
  ).first<{ created_at: number }>();

  const now = Math.floor(Date.now() / 1000);
  if (recent && now - recent.created_at < MIN_SECONDS_BETWEEN_SENDS) {
    return accepted;
  }

  const token = await createResetToken(env);
  const link = `${baseUrl(req)}/admin/reset?token=${token}`;

  const result = await sendEmail(env, {
    to: credential.username,
    subject: "Reset your Skrubb-it admin password",
    text: [
      "Someone asked to reset the password for the Skrubb-it admin console.",
      "",
      "Open this link to choose a new one. It works once and expires in an hour:",
      link,
      "",
      "If this wasn't you, ignore this email — nothing has changed, and the",
      "current password still works.",
    ].join("\n"),
    html: `
      <p>Someone asked to reset the password for the Skrubb-it admin console.</p>
      <p><a href="${link}">Choose a new password</a></p>
      <p>The link works once and expires in an hour.</p>
      <p>If this wasn't you, ignore this email — nothing has changed, and the
      current password still works.</p>
    `,
  });

  if (!result.ok) {
    console.error("admin password reset email failed:", result.detail);
  }

  return accepted;
}
