import { getCloudflareContext } from "@opennextjs/cloudflare";

import { buildPackPdf } from "@/lib/pack-pdf";
import { getCompanyProfile } from "@/lib/company";
import { getPricing, getTender, listDocuments, sastToday } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The whole tender pack as one PDF, certificates appended as further pages.
 *
 * Built server-side rather than printed from the browser so the bid is a
 * single file: the paperwork we author, then each stored certificate behind
 * its own separator page. Nothing here is cached — a pack reflects the state
 * of the bid at the moment it was generated.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const [loaded, documents, pricing, profile] = await Promise.all([
    getTender(id),
    listDocuments(),
    getPricing(id),
    getCompanyProfile(),
  ]);
  if (!loaded) return new Response("Not found", { status: 404 });

  // Certificates are fetched up front: buildPackPdf is pure given its inputs,
  // which keeps the layout code free of storage concerns and testable.
  const files = new Map<number, { bytes: Uint8Array; type: string }>();
  for (const doc of documents) {
    if (!doc.fileKey) continue;
    const object = await env.PRODUCT_IMAGES.get(doc.fileKey);
    if (!object) continue;
    files.set(doc.id, {
      bytes: new Uint8Array(await object.arrayBuffer()),
      type: doc.fileType,
    });
  }

  let pdf: Uint8Array;
  try {
    pdf = await buildPackPdf({
      tender: loaded.tender,
      items: loaded.items,
      documents,
      pricing,
      profile,
      files,
      today: sastToday(),
    });
  } catch (err) {
    console.error("[pack.pdf] build failed", err);
    return Response.json(
      { error: "Could not build the pack. Check that uploaded certificates are valid PDFs or images." },
      { status: 500 }
    );
  }

  const safeRef = loaded.tender.reference.replace(/[^A-Za-z0-9._-]+/g, "-") || "tender";

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="tender-pack-${safeRef}.pdf"`,
      // Contains company tax paperwork; never let a shared cache hold it.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
