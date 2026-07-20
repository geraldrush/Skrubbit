/**
 * Skrubb-it product catalogue.
 *
 * This is the single source of truth for the shop. It is imported by both the
 * React components and the API route handlers (app/api/products).
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

export const products: Product[] = [
  {
    slug: "dishwashing-liquid",
    name: "Dishwashing Liquid",
    tagline: "Tough on grease, gentle on hands.",
    description:
      "A concentrated, high-foam dishwashing liquid that cuts through grease and baked-on food fast. A little goes a long way, leaving dishes squeaky clean and sparkling.",
    category: "kitchen",
    image: "/images/products/dishwashing-liquid.jpg",
    featured: true,
    scents: ["Lemon", "Apple", "Original"],
    usage: [
      "Add a small squirt to warm water for everyday dishes.",
      "Apply directly to stubborn, greasy pots and pans.",
      "Safe for hand-washing glassware and cutlery.",
    ],
    variants: [
      { size: "750 ml", sku: "DW-750", price: 32.9 },
      { size: "5 L", sku: "DW-5L", price: 129.9 },
      { size: "25 L", sku: "DW-25L", price: 489.0 },
    ],
  },
  {
    slug: "pine-gel",
    name: "Pine Gel",
    tagline: "Fresh pine clean for every surface.",
    description:
      "A thick, economical multi-purpose pine gel that cleans, deodorises and leaves a long-lasting fresh pine fragrance throughout the home. Ideal for floors, walls and hard surfaces.",
    category: "floors",
    image: "/images/products/pine-gel.jpg",
    featured: true,
    scents: ["Pine", "Lavender", "Ocean"],
    usage: [
      "Dilute in a bucket of water to mop floors.",
      "Use neat on tough stains and high-traffic areas.",
      "Great as a general surface and drain deodoriser.",
    ],
    variants: [
      { size: "2 L", sku: "PG-2L", price: 44.9 },
      { size: "5 L", sku: "PG-5L", price: 94.9 },
    ],
  },
  {
    slug: "thick-bleach",
    name: "Thick Bleach",
    tagline: "Clings, whitens and disinfects.",
    description:
      "A thick, clinging bleach that stays on vertical and angled surfaces for a deeper clean. Whitens, brightens and kills germs around the toilet, drains and hard surfaces.",
    category: "disinfectants",
    image: "/images/products/thick-bleach.png",
    featured: true,
    usage: [
      "Apply under the toilet rim and leave for 10 minutes.",
      "Dilute for whitening and disinfecting surfaces.",
      "Do not mix with other cleaning products.",
    ],
    variants: [
      { size: "5 L", sku: "TB-5L", price: 74.9 },
      { size: "20 L", sku: "TB-20L", price: 249.0 },
      { size: "25 L", sku: "TB-25L", price: 299.0 },
    ],
  },
  {
    slug: "bleach",
    name: "Regular Bleach",
    tagline: "Everyday whitening & disinfecting.",
    description:
      "A versatile household bleach for laundry whitening, surface disinfecting and general hygiene. Economical bulk sizing for households and businesses.",
    category: "disinfectants",
    image: "/images/products/bleach.png",
    usage: [
      "Dilute for laundry whitening and stain removal.",
      "Disinfect surfaces, drains and bins.",
      "Always dilute as directed; keep away from fabrics you don't want lightened.",
    ],
    variants: [{ size: "25 L", sku: "BL-25L", price: 219.0 }],
  },
  {
    slug: "toilet-cleaner",
    name: "Toilet Cleaner",
    tagline: "A fresh, germ-free bathroom.",
    description:
      "A powerful toilet cleaner that removes stains and limescale while killing germs and leaving a fresh fragrance. The angled bottle reaches right under the rim.",
    category: "bathroom",
    image: "/images/products/toilet-cleaner.jpg",
    featured: true,
    usage: [
      "Squeeze under the rim and around the bowl.",
      "Leave for a few minutes, then brush and flush.",
      "Use regularly to prevent stain build-up.",
    ],
    variants: [
      { size: "750 ml", sku: "TC-750", price: 34.9 },
      { size: "5 L", sku: "TC-5L", price: 119.0 },
      { size: "25 L", sku: "TC-25L", price: 449.0 },
    ],
  },
  {
    slug: "fabric-softener",
    name: "Fabric Softener",
    tagline: "Soft, fresh, long-lasting fragrance.",
    description:
      "A rich, concentrated fabric softener that leaves laundry beautifully soft, static-free and gorgeously fragrant wash after wash.",
    category: "laundry",
    image: "/images/products/fabric-softener.jpg",
    scents: ["Spring Fresh", "Lavender", "Baby Soft"],
    usage: [
      "Add to the softener compartment of your machine.",
      "For hand-washing, add to the final rinse.",
      "Concentrated — no need to over-pour.",
    ],
    variants: [
      { size: "5 L", sku: "FS-5L", price: 99.9 },
      { size: "25 L", sku: "FS-25L", price: 379.0 },
    ],
  },
  {
    slug: "mop-and-shine",
    name: "Mop & Shine",
    tagline: "Clean floors with a brilliant shine.",
    description:
      "An all-in-one floor cleaner that cleans and adds a streak-free shine in a single pass. Leaves floors gleaming with a fresh, welcoming fragrance.",
    category: "floors",
    image: "/images/products/mop-and-shine.png",
    usage: [
      "Dilute in water and mop as usual — no rinsing needed.",
      "Safe on tiles, vinyl and sealed floors.",
      "Buff lightly for extra shine.",
    ],
    variants: [{ size: "5 L", sku: "MS-5L", price: 109.0 }],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCategory(id: CategoryId): Category | undefined {
  return categories.find((c) => c.id === id);
}

/** Lowest variant price for a product — used for "from R…" labels. */
export function fromPrice(product: Product): number {
  return Math.min(...product.variants.map((v) => v.price));
}
