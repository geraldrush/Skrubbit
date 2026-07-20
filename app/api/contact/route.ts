import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ContactPayload {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export async function POST(req: Request) {
  let body: ContactPayload;
  try {
    body = (await req.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || !body.email || !body.message) {
    return NextResponse.json(
      { error: "Name, email and message are required." },
      { status: 400 }
    );
  }

  // TODO(launch): deliver this enquiry somewhere real. Options on Cloudflare:
  //   • Cloudflare Email Routing / Email Workers, or a provider like Resend
  //   • Store in D1 (a `contact_messages` table)
  //   • Forward to a WhatsApp Business API / webhook
  // For now we just log it so the flow works end-to-end.
  console.log("[contact] new enquiry:", {
    name: body.name,
    email: body.email,
    phone: body.phone ?? "",
    message: body.message,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
