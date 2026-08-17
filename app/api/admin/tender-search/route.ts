import { getCloudflareContext } from "@opennextjs/cloudflare";

import { searchTenders } from "@/lib/etenders";
import { getSyncState, runSyncBatch, syncIsDue } from "@/lib/etenders-sync";
import { findImportedOcids } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Searches the mirrored eTenders feed.
 *
 * Reads D1 rather than the live feed, so a search is instant and returns every
 * open tender rather than whatever one slow page happened to contain. "Open"
 * means the closing date has not passed, regardless of when the tender was
 * advertised — the same basis etenders.gov.za lists on.
 *
 * If the mirror is stale, a crawl batch is kicked off in the background after
 * the response goes out. The search still answers from what is already there,
 * so a stale mirror degrades to slightly old data rather than to a spinner.
 */
export async function GET(req: Request) {
  const { env, ctx } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const url = new URL(req.url);

  try {
    const [result, state] = await Promise.all([
      searchTenders({
        keyword: url.searchParams.get("q") ?? "",
        province: url.searchParams.get("province") ?? "",
        category: url.searchParams.get("category") ?? "",
      }),
      getSyncState(),
    ]);

    const imported = await findImportedOcids();

    if (await syncIsDue()) {
      ctx.waitUntil(
        runSyncBatch().catch((err) => console.error("[tender-search] sync failed", err))
      );
    }

    return Response.json({
      matched: result.matched,
      available: result.available,
      sync: state,
      tenders: result.tenders.map((t) => ({ ...t, imported: imported.has(t.ocid) })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tender-search] failed", message);
    return Response.json({ error: `Search failed. ${message}` }, { status: 500 });
  }
}
