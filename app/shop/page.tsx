import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { ShopGrid } from "@/components/shop-grid";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/products";
import { getProducts } from "@/lib/products";

// Catalogue comes from D1, so this page renders per-request rather than being
// prerendered — new products appear as soon as they are added in /admin.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop Cleaning Products — Bleach, Pine Gel, Dishwashing Liquid",
  alternates: { canonical: "/shop" },
  description:
    "Buy Skrubb-it cleaning products online — dishwashing liquid, pine gel, bleach, toilet cleaner, fabric softener and degreasers in retail and bulk sizes. Made in Limpopo, delivered across South Africa.",
};

/**
 * The grid is the point of this page, so it does not read through
 * `getProductsSafe`: an empty list and an unreachable database mean opposite
 * things to a customer, and both would render as a shop with nothing in it.
 * The failure is caught here instead and said out loud.
 *
 * The page still answers 200 rather than throwing. The shop exists and its URL
 * is sound — it is the catalogue behind it that is briefly unavailable — and a
 * customer who came here to buy something is better served by a page that
 * explains itself and offers another way to reach us than by an error screen.
 */
export default async function ShopPage() {
  let products: Product[] | null = null;
  try {
    products = await getProducts();
  } catch (error) {
    console.error("shop catalogue read failed; rendering the unavailable notice", error);
  }

  return (
    <div className="container py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-extrabold">Shop</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Professional-strength cleaning products and personal care essentials,
          in retail and bulk sizes. Add to cart and send your order — we confirm by email.
        </p>
      </header>
      {products === null ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-display text-lg font-bold">
            The catalogue isn&apos;t loading right now
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            This is temporary and nothing has changed about what we stock. Try
            again shortly, or get in touch and we&apos;ll send you the range and
            current prices directly.
          </p>
          <Button asChild className="mt-6">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      ) : (
        <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading products…</div>}>
          <ShopGrid products={products} />
        </Suspense>
      )}
    </div>
  );
}
