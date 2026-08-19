import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireAdmin } from "@/lib/admin-auth";
import { deleteLibraryDocument, getLibraryDocument } from "@/lib/library";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Streams the file through the session rather than handing out a bucket URL. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });

  const doc = await getLibraryDocument(id);
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  const object = await env.PRODUCT_IMAGES.get(doc.fileKey);
  if (!object) {
    return Response.json({ error: "The stored file is missing." }, { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "content-type": doc.fileType || "application/octet-stream",
      "content-disposition": `attachment; filename="${doc.fileName || "document"}"`,
      // Never cached by a shared proxy: some of these are trade secrets.
      "cache-control": "no-store, private",
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });

  await deleteLibraryDocument(id);
  return Response.json({ ok: true });
}
