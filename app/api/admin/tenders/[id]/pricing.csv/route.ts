import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getPricing, getTender, priceTotals, VAT_RATE } from "@/lib/tenders";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Quotes a CSV field, doubling any embedded quotes. */
function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The pricing schedule as CSV, for Excel.
 *
 * Served as a download from the server rather than built in the browser so the
 * file is identical to what the printed schedule shows, and so it stays behind
 * the admin gate.
 *
 * Cost and margin are deliberately excluded: this file is one careless
 * forward away from the buyer, and our cost price is nobody else's business.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const loaded = await getTender(id);
  if (!loaded) return new Response("Not found", { status: 404 });

  const lines = await getPricing(id);
  const totals = priceTotals(lines);

  const rows: string[] = [];
  rows.push(["Item", "Description", "Unit", "Quantity", "Unit price (excl VAT)", "Total (excl VAT)"].map(cell).join(","));
  lines.forEach((l, i) => {
    rows.push(
      [
        i + 1,
        l.description,
        l.unit,
        l.quantity,
        l.unitPrice.toFixed(2),
        (l.quantity * l.unitPrice).toFixed(2),
      ]
        .map(cell)
        .join(",")
    );
  });
  rows.push("");
  rows.push([" ", " ", " ", " ", "Subtotal (excl VAT)", totals.excl.toFixed(2)].map(cell).join(","));
  rows.push([" ", " ", " ", " ", `VAT @ ${(VAT_RATE * 100).toFixed(0)}%`, totals.vat.toFixed(2)].map(cell).join(","));
  rows.push([" ", " ", " ", " ", "Total (incl VAT)", totals.incl.toFixed(2)].map(cell).join(","));

  const safeRef = loaded.tender.reference.replace(/[^A-Za-z0-9._-]+/g, "-") || "tender";

  // Leading BOM so Excel on Windows reads it as UTF-8 rather than mangling
  // the Rand sign and any accented supplier names.
  return new Response(`﻿${rows.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pricing-${safeRef}.csv"`,
      "cache-control": "no-store",
    },
  });
}
