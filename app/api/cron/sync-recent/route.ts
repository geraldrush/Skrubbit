import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireCron } from "@/lib/cron-auth";
import { syncRecentAdverts } from "@/lib/etenders-sync";
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

  const result = await syncRecentAdverts();
  if (!result.claimed) {
    return Response.json({
      ok: true,
      local,
      skipped: "A feed sync was already running.",
    });
  }
  return Response.json({ ok: true, local, ...result });
}
