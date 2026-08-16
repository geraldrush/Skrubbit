import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { isAdminRequest, passwordAuthConfigured } from "@/lib/admin-auth";
import { LoginForm } from "@/components/admin/login-form";

/**
 * Server-side guard for admin pages.
 *
 * Returns the sign-in screen when the caller is not an authenticated admin,
 * or null when they are. Callers must `return` a non-null result *before*
 * loading any data, which is why this hands back an element rather than
 * wrapping children: wrapping would let the page's own queries run for
 * anonymous visitors even though their output was never rendered.
 *
 * Mirrors the API guard so pages fail closed too, rather than exposing
 * anything if Access is ever misconfigured.
 */
export async function adminGate(): Promise<React.ReactElement | null> {
  const { env } = getCloudflareContext();
  const h = await headers();
  const req = new Request("https://admin.local", { headers: h });

  if (await isAdminRequest(req, env)) return null;

  return (
    <div className="container py-16">
      <h1 className="mb-6 text-center font-display text-3xl font-extrabold">
        Admin
      </h1>
      {passwordAuthConfigured(env) ? (
        <LoginForm />
      ) : (
        <p className="mx-auto max-w-prose text-center text-muted-foreground">
          This page is not available. Admin sign-in has not been configured yet.
        </p>
      )}
    </div>
  );
}
