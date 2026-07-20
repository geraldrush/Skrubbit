import { getCloudflareContext } from "@opennextjs/cloudflare";

import { categories, type CategoryId } from "@/data/products";
import { createProduct, slugExists } from "@/lib/products";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface VariantInput {
  size?: unknown;
  sku?: unknown;
  price?: unknown;
}

interface ProductInput {
  slug?: unknown;
  name?: unknown;
  tagline?: unknown;
  description?: unknown;
  category?: unknown;
  image?: unknown;
  featured?: unknown;
  scents?: unknown;
  usage?: unknown;
  variants?: unknown;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let body: ProductInput;
  try {
    body = (await req.json()) as ProductInput;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = str(body.slug).toLowerCase();
  const name = str(body.name);
  const category = str(body.category);
  const errors: string[] = [];

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    errors.push("Slug must be lowercase letters, numbers and single hyphens.");
  }
  if (!name) errors.push("Name is required.");
  if (!categories.some((c) => c.id === category)) {
    errors.push(`Category must be one of: ${categories.map((c) => c.id).join(", ")}.`);
  }

  // Variants carry the price, and a product with none would be invisible in
  // the shop (getProducts filters those out), so require at least one.
  const rawVariants = Array.isArray(body.variants) ? (body.variants as VariantInput[]) : [];
  const variants = rawVariants
    .map((v) => ({ size: str(v.size), sku: str(v.sku), price: Number(v.price) }))
    .filter((v) => v.size || v.sku || Number.isFinite(v.price));

  if (!variants.length) {
    errors.push("At least one variant (size, SKU and price) is required.");
  }
  variants.forEach((v, i) => {
    if (!v.size) errors.push(`Variant ${i + 1}: size is required.`);
    if (!v.sku) errors.push(`Variant ${i + 1}: SKU is required.`);
    if (!Number.isFinite(v.price) || v.price < 0) {
      errors.push(`Variant ${i + 1}: price must be a positive number.`);
    }
  });

  const skus = variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    errors.push("Variant SKUs must be unique within a product.");
  }

  if (errors.length) {
    return Response.json({ error: errors.join(" ") }, { status: 400 });
  }

  if (await slugExists(slug)) {
    return Response.json(
      { error: `A product with the slug "${slug}" already exists.` },
      { status: 409 }
    );
  }

  try {
    await createProduct({
      slug,
      name,
      tagline: str(body.tagline),
      description: str(body.description),
      category: category as CategoryId,
      image: str(body.image),
      featured: body.featured === true,
      scents: strList(body.scents),
      usage: strList(body.usage),
      variants,
    });
  } catch (err) {
    // Most likely a duplicate SKU, which is a primary key across all products.
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
