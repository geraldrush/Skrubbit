import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getTender } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Proof that the bid was delivered — a stamped bid-box receipt, a courier
 * waybill, a portal confirmation.
 *
 * Stored under the private `documents/` prefix like the compliance
 * certificates, so app/img refuses it and it is reachable only here, behind
 * the admin gate. This is the document you produce when a municipality says
 * the bid never arrived, so losing it matters more than most uploads.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
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

  const loaded = await getTender(id);
  if (!loaded) return Response.json({ error: "Not found" }, { status: 404 });

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
      { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under 10 MB.` },
      { status: 400 }
    );
  }

  const key = `documents/receipt-${id}-${Date.now().toString(36)}.${EXT[file.type]}`;
  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  if (loaded.tender.receiptFileKey) {
    await env.PRODUCT_IMAGES.delete(loaded.tender.receiptFileKey).catch(() => {});
  }

  await env.DB.prepare(
    `UPDATE tenders
        SET receipt_file_key = ?, receipt_file_name = ?, receipt_file_type = ?,
            receipt_file_size = ?
      WHERE id = ?`
  )
    .bind(key, file.name.slice(0, 200), file.type, file.size, id)
    .run();

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

  const loaded = await getTender(id);
  if (!loaded?.tender.receiptFileKey) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.PRODUCT_IMAGES.get(loaded.tender.receiptFileKey);
  if (!object) return new Response("Not found", { status: 404 });

  const filename = (loaded.tender.receiptFileName || "receipt.pdf").replace(/["\\]/g, "");

  return new Response(object.body, {
    headers: {
      "content-type": loaded.tender.receiptFileType || "application/octet-stream",
      "content-disposition": `inline; filename="${filename}"`,
      "x-content-type-options": "nosniff",
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

  const loaded = await getTender(id);
  if (!loaded) return Response.json({ error: "Not found" }, { status: 404 });

  if (loaded.tender.receiptFileKey) {
    await env.PRODUCT_IMAGES.delete(loaded.tender.receiptFileKey).catch(() => {});
    await env.DB.prepare(
      `UPDATE tenders
          SET receipt_file_key = NULL, receipt_file_name = '',
              receipt_file_type = '', receipt_file_size = 0
        WHERE id = ?`
    )
      .bind(id)
      .run();
  }
  return Response.json({ ok: true });
}
