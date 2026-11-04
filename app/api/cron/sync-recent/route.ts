import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireCron } from "@/lib/cron-auth";
import { backfillProvinces, syncRecentAdverts } from "@/lib/etenders-sync";
import { syncLocalSources } from "@/lib/local-sources";

export const dynamic = "force-dynamic";

/**
 * Pulls the last few days of eTenders adverts into the mirror.
 *
 * Runs just before the daily reminder pass, because the new-tender digest can
 * only announce what has been mirrored. The background crawl that page visits
 * trigger is built for completeness and moves too slowly to be relied on for
 * freshness — see syncRecentAdverts().
 *
 * Also reads the local buyers who advertise on their own website and never
 * touch the portal — see lib/local-sources.ts. Those run first: they are two
 * quick page reads, and they must not be lost to the feed timing out.
 *
 * Separate from /api/cron/reminders so that the feed being slow or down can
 * cost at most this call: the reminders still go out afterwards on whatever is
 * already mirrored.
 */
export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = requireCron(req, env as { CRON_SECRET?: string });
  if (denied) return denied;

  const local = await syncLocalSources();

  // One-time backfill: tag existing mirrored tenders with inferred provinces
  // after the eTenders API dropped the field. Harmless to re-run — rows with
  // a province already set are skipped, and once every empty row that can be
  // tagged has been, this returns 0 in under a millisecond.
  const backfilled = await backfillProvinces();

  const result = await syncRecentAdverts();
  if (!result.claimed) {
    return Response.json({
      ok: true,
      local,
      backfilled,
      skipped: "A feed sync was already running.",
    });
  }
  return Response.json({ ok: true, local, backfilled, ...result });
}
