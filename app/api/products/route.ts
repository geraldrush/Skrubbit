import { NextResponse } from "next/server";

import { categories } from "@/data/products";
import { getProducts } from "@/lib/products";

// Reads from D1, so this can no longer be prerendered at build time —
// otherwise newly added products would not appear until the next deploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getProducts();
  return NextResponse.json({ products, categories });
}
