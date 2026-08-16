import { NextResponse } from "next/server";

import {
  LIMITS,
  clamp,
  normaliseItems,
  recordOrder,
  subtotalOf,
} from "@/lib/enquiries";

export const dynamic = "force-dynamic";

/**
 * Records an order enquiry.
 *
 * WhatsApp is still the primary channel and is opened on the client, so this
 * endpoint must never block checkout — but it is no longer only a log line.
 * The order is written to D1 so there is a durable record even when the
 * customer never hits send in WhatsApp (popup blocked, app not installed, tab
 * closed), which used to lose the sale silently.
 *
 * The subtotal is recomputed from the stored line items rather than trusting
 * the one the client sends, so a stored order always adds up to its own lines.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = normaliseItems(body.items);
  const rawCustomer = (body.customer ?? {}) as Record<string, unknown>;
  const customer = {
    name: clamp(rawCustomer.name, LIMITS.name),
    phone: clamp(rawCustomer.phone, LIMITS.phone),
    email: clamp(rawCustomer.email, LIMITS.email),
    address: clamp(rawCustomer.address, LIMITS.address),
    note: clamp(rawCustomer.note, LIMITS.note),
  };

  if (!items.length || !customer.name) {
    return NextResponse.json({ error: "Empty order." }, { status: 400 });
  }

  // Timestamp for readability plus a random suffix: the reference is a primary
  // key and two checkouts can land in the same millisecond.
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.floor(Math.random() * 46_656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  const reference = `SK-${stamp}-${suffix}`;

  try {
    await recordOrder(reference, items, customer);
  } catch (err) {
    // Best-effort by design: the customer is about to be handed to WhatsApp
    // with the full order in the message, so a D1 failure must not become a
    // failed checkout. Logged without customer details — keeping PII out of
    // the platform logs is half the reason these live in D1 now.
    console.error("[order] could not persist", reference, err);
  }

  return NextResponse.json({
    ok: true,
    reference,
    subtotal: subtotalOf(items),
  });
}
