import { getCloudflareContext } from "@opennextjs/cloudflare";

import { deleteProduct, getProduct } from "@/lib/products";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const { slug } = await params;
  if (!(await getProduct(slug))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // The R2 image is intentionally left in place: keys are immutable and cheap,
  // and orphaning one is far better than deleting an image another product
  // might still reference.
  await deleteProduct(slug);
  return Response.json({ ok: true });
}
