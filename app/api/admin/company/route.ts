import { getCloudflareContext } from "@opennextjs/cloudflare";

import { updateCompanyProfile, type CompanyProfile } from "@/lib/company";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 500): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Saves the company particulars used by generated tender documents. */
export async function PUT(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profile: CompanyProfile = {
    legalName: str(body.legalName, 200),
    tradingName: str(body.tradingName, 200),
    registrationNumber: str(body.registrationNumber, 60),
    vatNumber: str(body.vatNumber, 60),
    // Defaults to false on anything but an explicit true, so the safe case
    // (quote no VAT) is what a malformed payload produces.
    vatRegistered: body.vatRegistered === true,
    physicalAddress: str(body.physicalAddress, 500),
    postalAddress: str(body.postalAddress, 500),
    signatoryName: str(body.signatoryName, 200),
    signatoryPosition: str(body.signatoryPosition, 200),
    phone: str(body.phone, 60),
    email: str(body.email, 200),
    website: str(body.website, 200),
    // The reusable profile paragraphs, so this one is allowed to be long.
    profileText: str(body.profileText, 8000),
    notifyEmail: str(body.notifyEmail, 200),
  };

  await updateCompanyProfile(profile);
  return Response.json({ ok: true });
}
