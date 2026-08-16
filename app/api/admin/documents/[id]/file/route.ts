import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  clearDocumentFile,
  getDocument,
  setDocumentFile,
} from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Stored compliance certificates.
 *
 * These are tax documents and company certificates — materially more
 * sensitive than product photos. Three things keep them private:
 *
 *   1. Every method here is behind requireAdmin.
 *   2. Keys are written under `documents/`, and app/img/[...key] serves only
 *      `products/`, so the public image route cannot reach them.
 *   3. Downloads are streamed through this route with no-store, never handed
 *      out as a shareable bucket URL.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — certificates are small
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });

  const doc = await getDocument(id);
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { error: `Unsupported type ${file.type || "unknown"}. Use PDF, PNG, JPEG or WebP.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep certificates under 10 MB.` },
      { status: 400 }
    );
  }

  // Timestamped key so replacing a certificate never overwrites the object a
  // previously generated pack was built against.
  const key = `documents/${id}-${Date.now().toString(36)}.${EXT[file.type]}`;
  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  // Remove the superseded object rather than letting the bucket accumulate
  // old tax documents indefinitely.
  if (doc.fileKey) {
    await env.PRODUCT_IMAGES.delete(doc.fileKey).catch(() => {});
  }

  await setDocumentFile(id, {
    key,
    name: file.name.slice(0, 200),
    type: file.type,
    size: file.size,
  });

  return Response.json({ ok: true, name: file.name, size: file.size });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null) return new Response("Not found", { status: 404 });

  const doc = await getDocument(id);
  if (!doc?.fileKey) return new Response("Not found", { status: 404 });

  const object = await env.PRODUCT_IMAGES.get(doc.fileKey);
  if (!object) return new Response("Not found", { status: 404 });

  const filename = (doc.fileName || `${doc.kind}.pdf`).replace(/["\\]/g, "");

  return new Response(object.body, {
    headers: {
      "content-type": doc.fileType || "application/octet-stream",
      // inline so a PDF opens in the viewer rather than forcing a save
      "content-disposition": `inline; filename="${filename}"`,
      "x-content-type-options": "nosniff",
      // Never cached by a shared cache: this is private company paperwork.
      "cache-control": "private, no-store",
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

  const doc = await getDocument(id);
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  if (doc.fileKey) {
    await env.PRODUCT_IMAGES.delete(doc.fileKey).catch(() => {});
    await clearDocumentFile(id);
  }
  return Response.json({ ok: true });
}
