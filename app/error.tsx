"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page throws while rendering — in practice, when a database read
 * fails.
 *
 * There was no error boundary here before, so Next.js served its own unstyled
 * "Application error: a server-side exception has occurred" screen. That is
 * what customers saw when an unrelated site on the same Cloudflare account
 * exhausted D1's row-read limit, which is charged per account rather than per
 * database: nothing about Skrubb-it was broken, but the whole page went blank.
 *
 * Most pages no longer reach this. Reads whose absence is merely a gap degrade
 * instead of throwing (see `getProductsSafe` and `getCompanyProfileSafe`), and
 * the shop says so in place of its grid. What is left are the pages that
 * genuinely cannot continue — a product page whose product could not be read —
 * and for those this keeps the response a 500 rather than a 404, so the URL is
 * treated as temporarily unwell rather than gone.
 *
 * `reset` re-renders the route without a full page load, which is the right
 * offer here: these failures are transient by nature, so trying again is
 * usually all that is needed.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches the Worker's logs, where the digest can be matched to the
    // stack trace. The message itself is never shown to the visitor.
    console.error("Unhandled error rendering page", error);
  }, [error]);

  return (
    <div className="container flex flex-col items-center justify-center gap-5 py-28 text-center">
      <p className="font-display text-7xl font-extrabold text-primary drop-shadow-sm">
        Oops
      </p>
      <h1 className="font-display text-2xl font-bold">
        Something went wrong at our end
      </h1>
      <p className="max-w-md text-muted-foreground">
        This one&apos;s on us, not you, and it&apos;s usually temporary. Give it
        another go — if it keeps happening, get in touch and we&apos;ll sort you
        out directly.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
