import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getRemoteTender } from "@/lib/etenders";
import { importTender } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Imports an advert into the register, seeding its compliance matrix.
 *
 * The advert is re-fetched from the feed by ocid rather than trusted from the
 * request body: the browser is only allowed to name which tender to import, so
 * a crafted payload can't write arbitrary values — including a closing date —
 * into the register.
 */
export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let ocid = "";
  try {
    const body = (await req.json()) as { ocid?: unknown };
    ocid = typeof body.ocid === "string" ? body.ocid.trim() : "";
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!ocid) {
    return Response.json({ error: "An ocid is required." }, { status: 400 });
  }

  let remote;
  try {
    remote = await getRemoteTender(ocid);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Could not reach the eTenders feed. ${message}` },
      { status: 502 }
    );
  }

  if (!remote) {
    return Response.json({ error: "That tender is no longer published." }, { status: 404 });
  }
  if (!remote.closingAt) {
    return Response.json(
      { error: "That advert has no closing date, so it can't be tracked." },
      { status: 422 }
    );
  }

  const id = await importTender({
    ocid: remote.ocid,
    reference: remote.reference,
    title: remote.title,
    description: remote.description,
    department: remote.department,
    closingAt: remote.closingAt,
    briefingAt: remote.briefingAt,
    briefingCompulsory: remote.briefingCompulsory,
    // Venue is the useful half of a briefing entry; the tender document holds
    // the tender box address, which is why the source URL is kept.
    submissionDetail: remote.briefingVenue,
    province: remote.province,
    category: remote.category,
    contactName: remote.contactName,
    contactEmail: remote.contactEmail,
    contactPhone: remote.contactPhone,
    sourceUrl: remote.documents[0]?.url ?? remote.sourceUrl,
  });

  return Response.json({ ok: true, id }, { status: 201 });
}
