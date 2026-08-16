import { getCloudflareContext } from "@opennextjs/cloudflare";

import { listDocuments } from "@/lib/tenders";
import { createZip, safeEntryName, type ZipEntry } from "@/lib/zip";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Every stored compliance certificate, as one download.
 *
 * The enclosures are the same for every bid, so this is a company-level route
 * rather than a per-tender one. Names are prefixed with an index so the files
 * extract in the same order the pack's enclosure schedule lists them, which is
 * the order they go into the binder.
 */
export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const documents = (await listDocuments()).filter((d) => d.fileKey);
  if (!documents.length) {
    return Response.json(
      { error: "No certificates have been uploaded yet." },
      { status: 404 }
    );
  }

  const entries: ZipEntry[] = [];
  for (const [i, doc] of documents.entries()) {
    const object = await env.PRODUCT_IMAGES.get(doc.fileKey!);
    // A row whose object has gone missing shouldn't fail the whole download.
    if (!object) continue;
    const data = new Uint8Array(await object.arrayBuffer());
    const index = String(i + 1).padStart(2, "0");
    entries.push({
      name: `${index} ${safeEntryName(doc.fileName || doc.label, `${doc.kind}.pdf`)}`,
      data,
    });
  }

  if (!entries.length) {
    return Response.json({ error: "No certificate files could be read." }, { status: 404 });
  }

  // Hand over the backing ArrayBuffer: the archive is allocated to its exact
  // length, so this is the whole file and nothing else.
  const zip = createZip(entries).buffer as ArrayBuffer;

  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="tender-enclosures.zip"',
      // Company tax paperwork: never let a shared cache hold this.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
