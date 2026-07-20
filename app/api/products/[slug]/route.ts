import { NextResponse } from "next/server";

import { getProduct } from "@/lib/products";

// generateStaticParams is gone with the move to D1: the set of slugs is no
// longer known at build time.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ product });
}
