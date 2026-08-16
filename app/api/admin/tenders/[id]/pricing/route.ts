import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getTender, replacePricing, type PricingInput } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** A quantity or price that is not a finite, non-negative number is zero. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null || !(await getTender(id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
  const lines: PricingInput[] = raw
    .slice(0, 300)
    .map((l) => ({
      description: typeof l.description === "string" ? l.description.trim().slice(0, 500) : "",
      unit: typeof l.unit === "string" ? l.unit.trim().slice(0, 60) || "each" : "each",
      quantity: num(l.quantity),
      costPrice: num(l.costPrice),
      unitPrice: num(l.unitPrice),
      productSlug:
        typeof l.productSlug === "string" && l.productSlug ? l.productSlug.slice(0, 120) : null,
    }))
    // A line with no description is a blank row the user left behind, not data.
    .filter((l) => l.description);

  await replacePricing(id, lines);
  return Response.json({ ok: true, lines: lines.length });
}
