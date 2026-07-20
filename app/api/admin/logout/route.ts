import { clearSessionCookieHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Clears the admin session.
 *
 * Deliberately unauthenticated: the only effect is discarding the caller's own
 * cookie, so requiring auth would just make signing out fail after expiry.
 */
export async function POST(req: Request) {
  const secure = new URL(req.url).protocol === "https:";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": clearSessionCookieHeader(secure),
    },
  });
}
