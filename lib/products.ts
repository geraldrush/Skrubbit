/**
 * Catalogue queries against D1.
 *
 * Replaces the hardcoded array that used to live in data/products.ts, so the
 * admin can add products without a redeploy. Types and the category taxonomy
 * still come from data/products.ts.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { CategoryId, Product, ProductVariant } from "@/data/products";

interface ProductRow {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  image: string;
  featured: number;
  scents: string;
  usage: string;
}

interface VariantRow {
  sku: string;
  product_slug: string;
  size: string;
  price: number;
}

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

/** Tolerates malformed JSON so one bad row can't take down the whole shop. */
function parseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function toProduct(row: ProductRow, variants: ProductVariant[]): Product {
  const scents = parseList(row.scents);
  const usage = parseList(row.usage);
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: row.category as CategoryId,
    image: row.image,
    featured: row.featured === 1,
    ...(scents.length ? { scents } : {}),
    ...(usage.length ? { usage } : {}),
    variants,
  };
}

/**
 * All products, each with its variants.
 *
 * Two queries rather than a JOIN + regroup: the catalogue is small, and this
 * keeps the row-shaping obvious.
 */
export async function getProducts(): Promise<Product[]> {
  const d = db();
  const [{ results: productRows }, { results: variantRows }] = await Promise.all([
    d.prepare("SELECT * FROM products ORDER BY created_at, slug").all<ProductRow>(),
    d
      .prepare("SELECT sku, product_slug, size, price FROM variants ORDER BY product_slug, position")
      .all<VariantRow>(),
  ]);

  const bySlug = new Map<string, ProductVariant[]>();
  for (const v of variantRows) {
    const list = bySlug.get(v.product_slug) ?? [];
    list.push({ sku: v.sku, size: v.size, price: v.price });
    bySlug.set(v.product_slug, list);
  }

  // A product with no variants has no price to show, so skip it rather than
  // letting fromPrice() return Infinity in the UI.
  return productRows
    .map((r) => toProduct(r, bySlug.get(r.slug) ?? []))
    .filter((p) => p.variants.length > 0);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const d = db();
  const row = await d.prepare("SELECT * FROM products WHERE slug = ?").bind(slug).first<ProductRow>();
  if (!row) return undefined;

  const { results } = await d
    .prepare("SELECT sku, product_slug, size, price FROM variants WHERE product_slug = ? ORDER BY position")
    .bind(slug)
    .all<VariantRow>();

  const variants = results.map((v) => ({ sku: v.sku, size: v.size, price: v.price }));
  if (!variants.length) return undefined;
  return toProduct(row, variants);
}

export interface NewProduct {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: CategoryId;
  image: string;
  featured: boolean;
  scents: string[];
  usage: string[];
  variants: ProductVariant[];
}

/**
 * Inserts a product and its variants as one batch, so a failure part-way
 * through can't leave a product with no variants (which would hide it).
 */
export async function createProduct(p: NewProduct): Promise<void> {
  const d = db();
  const statements = [
    d
      .prepare(
        `INSERT INTO products (slug, name, tagline, description, category, image, featured, scents, usage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        p.slug,
        p.name,
        p.tagline,
        p.description,
        p.category,
        p.image,
        p.featured ? 1 : 0,
        JSON.stringify(p.scents),
        JSON.stringify(p.usage)
      ),
    ...p.variants.map((v, i) =>
      d
        .prepare("INSERT INTO variants (sku, product_slug, size, price, position) VALUES (?, ?, ?, ?, ?)")
        .bind(v.sku, p.slug, v.size, v.price, i)
    ),
  ];
  await d.batch(statements);
}

/**
 * Updates a product in place, replacing its variants wholesale.
 *
 * The slug is the primary key and is not changeable here. Variants are deleted
 * and re-inserted rather than diffed: the set is small, and a full replace is
 * simpler to reason about than matching rows by SKU. The whole thing runs as
 * one batch so a mid-update failure can't leave the product variant-less.
 */
export async function updateProduct(
  slug: string,
  p: Omit<NewProduct, "slug">
): Promise<void> {
  const d = db();
  await d.batch([
    d
      .prepare(
        `UPDATE products
         SET name = ?, tagline = ?, description = ?, category = ?, image = ?,
             featured = ?, scents = ?, usage = ?
         WHERE slug = ?`
      )
      .bind(
        p.name,
        p.tagline,
        p.description,
        p.category,
        p.image,
        p.featured ? 1 : 0,
        JSON.stringify(p.scents),
        JSON.stringify(p.usage),
        slug
      ),
    d.prepare("DELETE FROM variants WHERE product_slug = ?").bind(slug),
    ...p.variants.map((v, i) =>
      d
        .prepare("INSERT INTO variants (sku, product_slug, size, price, position) VALUES (?, ?, ?, ?, ?)")
        .bind(v.sku, slug, v.size, v.price, i)
    ),
  ]);
}

export async function deleteProduct(slug: string): Promise<void> {
  // Variants are deleted explicitly rather than relying on ON DELETE CASCADE,
  // which only fires when SQLite foreign-key enforcement is on.
  const d = db();
  await d.batch([
    d.prepare("DELETE FROM variants WHERE product_slug = ?").bind(slug),
    d.prepare("DELETE FROM products WHERE slug = ?").bind(slug),
  ]);
}

export async function slugExists(slug: string): Promise<boolean> {
  const row = await db().prepare("SELECT 1 AS x FROM products WHERE slug = ?").bind(slug).first();
  return row !== null;
}
