import { NextResponse } from "next/server";
import { products, categories } from "@/data/products";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({ products, categories });
}
