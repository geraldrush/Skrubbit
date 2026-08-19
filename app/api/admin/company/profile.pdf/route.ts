import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireAdmin } from "@/lib/admin-auth";
import { getCompanyProfile } from "@/lib/company";
import { buildProfilePdf } from "@/lib/profile-pdf";

export const dynamic = "force-dynamic";

/**
 * The company profile as a PDF, built from the current D1 record.
 *
 * Generated per request rather than stored: the profile is edited whenever the
 * business changes, and a cached copy would be the one thing that goes out to a
 * buyer still claiming last year's turnover.
 */
export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const profile = await getCompanyProfile();

  // The letterhead logo lives with the site's static assets, so it is fetched
  // rather than bundled — a Worker cannot read from the filesystem. This is the
  // trimmed mark, not the square shop logo, which carries white margins that
  // would push it over the brand rule.
  let logo: Uint8Array | undefined;
  try {
    const res = await fetch(new URL("/images/brand/logo-letterhead.png", req.url), {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    // The letterhead still sets without it.
  }

  const pdf = await buildProfilePdf({
    profile,
    logo,
    today: new Date().toISOString().slice(0, 10),
  });

  const name = (profile.legalName || "company").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}-profile.pdf"`,
      "cache-control": "no-store",
    },
  });
}
