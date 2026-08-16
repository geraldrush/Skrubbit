import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createTender } from "@/lib/tenders";
import { validateTenderBody } from "@/lib/tender-validation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Creates a tender, seeding its compliance matrix from the guide checklist. */
export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateTenderBody(body);
  if ("errors" in result) {
    return Response.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  const id = await createTender(result.value);
  return Response.json({ ok: true, id }, { status: 201 });
}
