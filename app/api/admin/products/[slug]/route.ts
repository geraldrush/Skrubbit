import { getCloudflareContext } from "@opennextjs/cloudflare";

import { deleteProduct, getProduct, updateProduct } from "@/lib/products";
import { validateProductBody } from "@/lib/product-validation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PUT(
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

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateProductBody(body);
  if ("errors" in result) {
    return Response.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  try {
    await updateProduct(slug, result.value);
  } catch (err) {
    // A SKU now used by a different product trips the primary-key constraint;
    // the batch rolls back, so the product is left unchanged.
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE|PRIMARY KEY/i.test(message)) {
      return Response.json(
        { error: "One of those SKUs is already used by another product." },
        { status: 409 }
      );
    }
    throw err;
  }

  return Response.json({ ok: true, slug });
}

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
