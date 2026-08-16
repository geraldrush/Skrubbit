import { NextResponse } from "next/server";

import { LIMITS, clamp, recordContactMessage } from "@/lib/enquiries";

export const dynamic = "force-dynamic";

/**
 * Stores a contact-form enquiry.
 *
 * Unlike /api/orders there is no second channel here — if this write fails the
 * message is gone — so a persistence failure is reported as a 5xx rather than
 * swallowed. The form already tells the customer to WhatsApp instead when the
 * request fails, which is the honest outcome; the old version always answered
 * "ok" and dropped the message on the floor.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = clamp(body.name, LIMITS.name);
  const email = clamp(body.email, LIMITS.email);
  const phone = clamp(body.phone, LIMITS.phone);
  const message = clamp(body.message, LIMITS.message);

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email and message are required." },
      { status: 400 }
    );
  }

  try {
    await recordContactMessage(name, email, phone, message);
  } catch (err) {
    // No customer details in the log line: the message itself is the payload
    // we failed to store, and repeating it here would defeat the point.
    console.error("[contact] could not persist enquiry", err);
    return NextResponse.json(
      { error: "We couldn't save your message. Please WhatsApp us instead." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true });
}
