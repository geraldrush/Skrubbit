import { getCloudflareContext } from "@opennextjs/cloudflare";

import { searchTenders } from "@/lib/etenders";
import { findImportedOcids } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Searches live adverts on the National Treasury eTenders feed.
 *
 * Proxied through the Worker rather than called from the browser: it keeps the
 * upstream behind our own admin gate, lets responses be cached at the edge
 * instead of once per admin, and avoids depending on the feed's CORS policy.
 */
export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days"));

  try {
    const { tenders, scanned } = await searchTenders({
      keyword: url.searchParams.get("q") ?? "",
      province: url.searchParams.get("province") ?? "",
      category: url.searchParams.get("category") ?? "",
      advertisedWithinDays: Number.isFinite(days) && days > 0 ? Math.min(days, 180) : 60,
      openOnly: url.searchParams.get("all") !== "1",
    });

    // Mark the ones already in the register so they render as imported rather
    // than inviting a duplicate.
    const imported = await findImportedOcids(tenders.map((t) => t.ocid));

    return Response.json({
      scanned,
      tenders: tenders.map((t) => ({ ...t, imported: imported.has(t.ocid) })),
    });
  } catch (err) {
    // The feed is a third party; a bad day there must not look like a bug here.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tender-search] upstream failed", message);
    return Response.json(
      { error: `Could not reach the eTenders feed. ${message}` },
      { status: 502 }
    );
  }
}
