import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createDocument } from "@/lib/tenders";
import { validateDocumentBody } from "@/lib/tender-validation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Records a company compliance document.
 *
 * Metadata only — validity dates, reference numbers and where the file is
 * kept. The files themselves (certified IDs, tax documents) are deliberately
 * not stored by this app.
 */
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

  const result = validateDocumentBody(body);
  if ("errors" in result) {
    return Response.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  await createDocument(result.value);
  return Response.json({ ok: true }, { status: 201 });
}
