import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getSyncState, runSyncBatch } from "@/lib/etenders-sync";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Current progress, for the search page to poll while a run is in flight. */
export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  return Response.json(await getSyncState());
}

/**
 * Starts one batch of the crawl.
 *
 * Returns immediately and does the work in waitUntil: a batch takes tens of
 * seconds to minutes against a feed that is measured in 40-120s per page, far
 * longer than a browser will hold a request open. The caller polls GET for
 * progress instead.
 */
export async function POST(req: Request) {
  const { env, ctx } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const before = await getSyncState();
  if (before.running) {
    return Response.json({ ok: true, alreadyRunning: true, state: before });
  }

  ctx.waitUntil(
    runSyncBatch().catch((err) => {
      console.error("[tender-sync] batch failed", err);
    })
  );

  return Response.json({ ok: true, started: true, state: before });
}
