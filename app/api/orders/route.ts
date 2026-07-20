import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface OrderPayload {
  items?: Array<{ name: string; size: string; qty: number; price: number }>;
  subtotal?: number;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    note?: string;
  };
}

/**
 * Records an order enquiry. WhatsApp is the primary channel (opened on the
 * client), so this endpoint is best-effort and must never block checkout.
 */
export async function POST(req: Request) {
  let body: OrderPayload;
  try {
    body = (await req.json()) as OrderPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.items?.length || !body.customer?.name) {
    return NextResponse.json({ error: "Empty order." }, { status: 400 });
  }

  // Simple human-readable reference for the customer / your records.
  const reference = `SK-${Date.now().toString(36).toUpperCase()}`;

  // TODO(launch): persist to D1 (`orders` table) and/or email a copy to the
  // shop inbox so you have a record even if the customer doesn't hit send in
  // WhatsApp.
  console.log("[order] enquiry received:", {
    reference,
    subtotal: body.subtotal,
    items: body.items,
    customer: body.customer,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, reference });
}
