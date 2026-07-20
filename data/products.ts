/**
 * Product types and the category taxonomy.
 *
 * The catalogue itself now lives in D1 so it can be edited from /admin without
 * a redeploy — see lib/products.ts for the queries. Categories stay here on
 * purpose: they are a fixed taxonomy tied to the CategoryId union type, not
 * user-editable content.
 *
 * ⚠️  PRICES ARE PLACEHOLDERS. Replace `price` on each variant with real
 * retail pricing (ZAR) before launch. SKUs are also placeholders.
 */

export type CategoryId =
  | "kitchen"
  | "bathroom"
  | "laundry"
  | "floors"
  | "disinfectants"
  | "personal-care";

export interface Category {
  id: CategoryId;
  name: string;
  blurb: string;
}

export const categories: Category[] = [
  { id: "kitchen", name: "Kitchen", blurb: "Cut through grease and grime." },
  { id: "bathroom", name: "Bathroom", blurb: "Fresh, hygienic bathrooms." },
  { id: "laundry", name: "Laundry", blurb: "Soft, fresh, beautifully clean." },
  { id: "floors", name: "Floors & Surfaces", blurb: "Shine and protection." },
  { id: "disinfectants", name: "Bleach & Disinfectants", blurb: "Kill 99.9% of germs." },
  { id: "personal-care", name: "Personal Care", blurb: "Gentle everyday essentials." },
];

export interface ProductVariant {
  /** Human label, e.g. "5 L" */
  size: string;
  sku: string;
  /** ZAR — PLACEHOLDER */
  price: number;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: CategoryId;
  image: string;
  featured?: boolean;
  scents?: string[];
  /** Bullet points describing how / where to use it. */
  usage?: string[];
  variants: ProductVariant[];
}

export function getCategory(id: CategoryId): Category | undefined {
  return categories.find((c) => c.id === id);
}

/** Lowest variant price for a product — used for "from R…" labels. */
export function fromPrice(product: Product): number {
  return Math.min(...product.variants.map((v) => v.price));
}
