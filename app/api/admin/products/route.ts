import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createProduct, slugExists } from "@/lib/products";
import { validateProductBody } from "@/lib/product-validation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = (typeof body.slug === "string" ? body.slug : "").trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return Response.json(
      { error: "Slug must be lowercase letters, numbers and single hyphens." },
      { status: 400 }
    );
  }

  const result = validateProductBody(body);
  if ("errors" in result) {
    return Response.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  if (await slugExists(slug)) {
    return Response.json(
      { error: `A product with the slug "${slug}" already exists.` },
      { status: 409 }
    );
  }

  try {
    await createProduct({ slug, ...result.value });
  } catch (err) {
    // SKU is a primary key across all products, so a clash surfaces here.
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE|PRIMARY KEY/i.test(message)) {
      return Response.json(
        { error: "One of those SKUs is already used by another product." },
        { status: 409 }
      );
    }
    throw err;
  }

  return Response.json({ ok: true, slug }, { status: 201 });
}
