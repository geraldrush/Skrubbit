import { getCloudflareContext } from "@opennextjs/cloudflare";

import { deleteTenderFile, getTenderFile } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Both lookups are scoped by tender id, so a file id from another tender
 *  cannot be read or removed through this route. */
async function resolve(params: Promise<{ id: string; fileId: string }>) {
  const { id, fileId } = await params;
  const tenderId = Number(id);
  const idNum = Number(fileId);
  if (!Number.isInteger(tenderId) || tenderId <= 0) return null;
  if (!Number.isInteger(idNum) || idNum <= 0) return null;
  const file = await getTenderFile(tenderId, idNum);
  return file ? { tenderId, file } : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const found = await resolve(params);
  if (!found) return new Response("Not found", { status: 404 });

  const object = await env.PRODUCT_IMAGES.get(found.file.fileKey);
  if (!object) return new Response("Not found", { status: 404 });

  const filename = (found.file.fileName || "document.pdf").replace(/["\\]/g, "");

  return new Response(object.body, {
    headers: {
      "content-type": found.file.fileType || "application/octet-stream",
      "content-disposition": `inline; filename="${filename}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const found = await resolve(params);
  if (!found) return Response.json({ error: "Not found" }, { status: 404 });

  await env.PRODUCT_IMAGES.delete(found.file.fileKey).catch(() => {});
  await deleteTenderFile(found.tenderId, found.file.id);

  return Response.json({ ok: true });
}
