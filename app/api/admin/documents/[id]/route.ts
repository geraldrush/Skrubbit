import { getCloudflareContext } from "@opennextjs/cloudflare";

import { deleteDocument, getDocument, listDocuments, updateDocument } from "@/lib/tenders";
import { validateDocumentBody } from "@/lib/tender-validation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function exists(id: number): Promise<boolean> {
  return (await listDocuments()).some((d) => d.id === id);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null || !(await exists(id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

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

  await updateDocument(id, result.value);
  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null || !(await exists(id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Remove the stored certificate too. Unlike product images — which are
  // shared and cheap to orphan — these are tax documents, so deleting the
  // record must not leave the file sitting in the bucket.
  const doc = await getDocument(id);
  if (doc?.fileKey) {
    await env.PRODUCT_IMAGES.delete(doc.fileKey).catch(() => {});
  }

  await deleteDocument(id);
  return Response.json({ ok: true });
}
