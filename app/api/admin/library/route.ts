import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireAdmin } from "@/lib/admin-auth";
import { addLibraryDocument, type LibraryCategory } from "@/lib/library";

export const dynamic = "force-dynamic";

/**
 * Uploads a reference document.
 *
 * Stored under `library/`, which app/img/[...key] does not serve — it only
 * hands out `products/` — so nothing filed here is reachable without a session,
 * even by guessing the key.
 */

const MAX_BYTES = 25 * 1024 * 1024; // formulation books and datasheet packs
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "image/png",
  "image/jpeg",
]);
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
  "image/png": "png",
  "image/jpeg": "jpg",
};
const CATEGORIES = new Set(["datasheet", "formulation", "pricelist", "other"]);

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim().slice(0, 200);
  const category = String(form.get("category") ?? "other");
  const notes = String(form.get("notes") ?? "").trim().slice(0, 1000);
  const confidential = form.get("confidential") === "true";

  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!title) {
    return Response.json({ error: "Give the document a title." }, { status: 400 });
  }
  if (!CATEGORIES.has(category)) {
    return Response.json({ error: "Unknown category." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { error: `Unsupported type ${file.type || "unknown"}. Use PDF, XLSX, CSV or an image.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.` },
      { status: 400 }
    );
  }

  const slug =
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) ||
    "document";
  const key = `library/${Date.now()}-${slug}.${EXT[file.type]}`;

  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const id = await addLibraryDocument({
    title,
    category: category as LibraryCategory,
    notes,
    confidential,
    fileKey: key,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  return Response.json({ ok: true, id });
}
