import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  addTenderFile,
  getTender,
  TENDER_FILE_LABELS,
  type TenderFileKind,
} from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The tender's own paperwork: the advert, the blank official forms, a bill of
 * quantities, briefing attendance proof, addenda, correspondence.
 *
 * Stored under the private `documents/` prefix like everything else sensitive,
 * so app/img refuses it and it is reachable only through the admin-gated
 * download route.
 */

const MAX_BYTES = 25 * 1024 * 1024; // tender packs run to dozens of scanned pages
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await getTender(id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

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
      { error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Keep it under 25 MB.` },
      { status: 400 }
    );
  }

  const rawKind = String(form.get("kind") ?? "other");
  const kind: TenderFileKind = (
    Object.keys(TENDER_FILE_LABELS) as TenderFileKind[]
  ).includes(rawKind as TenderFileKind)
    ? (rawKind as TenderFileKind)
    : "other";

  const label = String(form.get("label") ?? "").trim().slice(0, 200);

  const key = `documents/tender-${id}-${Date.now().toString(36)}.${EXT[file.type]}`;
  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await addTenderFile(id, {
    kind,
    label: label || TENDER_FILE_LABELS[kind],
    key,
    name: file.name.slice(0, 200),
    type: file.type,
    size: file.size,
  });

  return Response.json({ ok: true, name: file.name, size: file.size });
}
