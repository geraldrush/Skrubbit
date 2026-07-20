/**
 * Shared validation for the create (POST) and edit (PUT) admin endpoints, so
 * both enforce identical rules on everything except the slug (which the create
 * route validates for format/uniqueness and the edit route takes from the URL).
 */

import { categories, type CategoryId, type ProductVariant } from "@/data/products";

export interface ValidatedProductBody {
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

interface RawVariant {
  size?: unknown;
  sku?: unknown;
  price?: unknown;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

/**
 * Returns the cleaned product body or a list of human-readable errors.
 * Does not touch the slug — callers handle that.
 */
export function validateProductBody(
  body: Record<string, unknown>
): { errors: string[] } | { value: ValidatedProductBody } {
  const errors: string[] = [];

  const name = str(body.name);
  const category = str(body.category);

  if (!name) errors.push("Name is required.");
  if (!categories.some((c) => c.id === category)) {
    errors.push(`Category must be one of: ${categories.map((c) => c.id).join(", ")}.`);
  }

  const rawVariants = Array.isArray(body.variants) ? (body.variants as RawVariant[]) : [];
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

  if (errors.length) return { errors };

  return {
    value: {
      name,
      tagline: str(body.tagline),
      description: str(body.description),
      category: category as CategoryId,
      image: str(body.image),
      featured: body.featured === true,
      scents: strList(body.scents),
      usage: strList(body.usage),
      variants,
    },
  };
}
