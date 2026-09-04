import Link from "next/link";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { ResetForm } from "@/components/admin/reset-form";
import { Button } from "@/components/ui/button";
import { checkResetToken } from "@/lib/admin-reset";

// The token arrives in the query string and is checked against the database,
// so there is nothing here to prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
  // The link is emailed and single-use; it has no business in an index.
  robots: { index: false, follow: false },
};

/**
 * Where the emailed reset link lands.
 *
 * The token is validated on the server before the form is drawn, so a dead
 * link says why immediately rather than after the admin has typed a password
 * twice. It is not proof of anything on its own — the POST re-checks and
 * spends it — this only decides which of the two screens to show.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { env } = getCloudflareContext();

  const check = token
    ? await checkResetToken(env, token)
    : ({ ok: false, reason: "invalid" } as const);

  if (!check.ok) {
    const message =
      check.reason === "expired"
        ? "That link has expired. Reset links last an hour."
        : check.reason === "used"
          ? "That link has already been used."
          : "That link isn't valid.";

    return (
      <div className="container py-16">
        <div className="mx-auto max-w-sm space-y-4 rounded-lg border p-6 text-center">
          <h1 className="font-display text-xl font-bold">Link no longer works</h1>
          <p className="text-sm text-muted-foreground">
            {message} Request a new one from the sign-in page.
          </p>
          <Button asChild className="w-full">
            <Link href="/admin">Back to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-16">
      <ResetForm token={token!} />
    </div>
  );
}
