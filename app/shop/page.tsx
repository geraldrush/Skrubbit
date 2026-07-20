import { Suspense } from "react";
import type { Metadata } from "next";

import { ShopGrid } from "@/components/shop-grid";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Browse Skrubb-it cleaning products and personal care essentials — dishwashing liquid, pine gel, bleach, toilet cleaner, fabric softener and more.",
};

export default function ShopPage() {
  return (
    <div className="container py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-extrabold">Shop</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Professional-strength cleaning products and personal care essentials,
          in retail and bulk sizes. Add to cart and check out on WhatsApp.
        </p>
      </header>
      <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Loading products…</div>}>
        <ShopGrid />
      </Suspense>
    </div>
  );
}
