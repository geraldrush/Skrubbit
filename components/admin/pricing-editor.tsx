"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatZAR } from "@/lib/utils";
import { VAT_RATE, type PricingLine } from "@/lib/tenders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The pricing schedule behind SBD 3.1 / 3.2 / 3.3.
 *
 * Lines are free-form because most bids are for goods we resell rather than
 * make: the shop catalogue can seed a line, but never drives it, and a quoted
 * price stays put even after the catalogue moves on.
 *
 * Cost is captured so margin is visible while quoting. It is shown here only —
 * it is not printed on the pack and not included in the CSV.
 */

interface CatalogueOption {
  slug: string;
  name: string;
  size: string;
  price: number;
}

interface Draft {
  description: string;
  unit: string;
  quantity: string;
  costPrice: string;
  unitPrice: string;
  productSlug: string | null;
}

const blank = (): Draft => ({
  description: "",
  unit: "each",
  quantity: "1",
  costPrice: "",
  unitPrice: "",
  productSlug: null,
});

const toDraft = (l: PricingLine): Draft => ({
  description: l.description,
  unit: l.unit,
  quantity: String(l.quantity),
  costPrice: l.costPrice ? String(l.costPrice) : "",
  unitPrice: l.unitPrice ? String(l.unitPrice) : "",
  productSlug: l.productSlug,
});

const n = (v: string): number => {
  const parsed = Number(v);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function PricingEditor({
  tenderId,
  lines,
  catalogue,
}: {
  tenderId: number;
  lines: PricingLine[];
  catalogue: CatalogueOption[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Draft[]>(
    lines.length ? lines.map(toDraft) : [blank()]
  );
  const [saving, setSaving] = React.useState(false);

  function patch(i: number, change: Partial<Draft>) {
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...change } : row)));
  }

  const totals = React.useMemo(() => {
    const excl = drafts.reduce((s, d) => s + n(d.quantity) * n(d.unitPrice), 0);
    const cost = drafts.reduce((s, d) => s + n(d.quantity) * n(d.costPrice), 0);
    const vat = excl * VAT_RATE;
    const margin = excl - cost;
    return {
      excl,
      vat,
      incl: excl + vat,
      margin,
      marginPct: excl > 0 ? (margin / excl) * 100 : 0,
      anyCost: cost > 0,
    };
  }, [drafts]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tenders/${tenderId}/pricing`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: drafts.map((d) => ({
            description: d.description,
            unit: d.unit,
            quantity: n(d.quantity),
            costPrice: n(d.costPrice),
            unitPrice: n(d.unitPrice),
            productSlug: d.productSlug,
          })),
        }),
      });
      const data = (await res.json()) as { error?: string; lines?: number };
      if (!res.ok) throw new Error(data.error ?? "Could not save pricing");
      toast.success(`Saved ${data.lines} line${data.lines === 1 ? "" : "s"}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save pricing");
    } finally {
      setSaving(false);
    }
  }

  function addFromCatalogue(slug: string) {
    const item = catalogue.find((c) => c.slug === slug);
    if (!item) return;
    setDrafts((d) => [
      ...d,
      {
        description: `${item.name} — ${item.size}`,
        unit: item.size,
        quantity: "1",
        costPrice: "",
        // Seeded from the shop as a starting point; tender pricing is quoted
        // per bid, so this is expected to be edited.
        unitPrice: String(item.price),
        productSlug: item.slug,
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="p-2 font-semibold">Description</th>
              <th className="w-24 p-2 font-semibold">Unit</th>
              <th className="w-20 p-2 font-semibold">Qty</th>
              <th className="w-28 p-2 font-semibold">Cost</th>
              <th className="w-28 p-2 font-semibold">Price</th>
              <th className="w-28 p-2 text-right font-semibold">Line total</th>
              <th className="w-10 p-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {drafts.map((d, i) => (
              <tr key={i}>
                <td className="p-2">
                  <Input
                    value={d.description}
                    onChange={(e) => patch(i, { description: e.target.value })}
                    placeholder="Heavy-duty degreaser, 25 L drum"
                    className="h-9"
                  />
                </td>
                <td className="p-2">
                  <Input
                    value={d.unit}
                    onChange={(e) => patch(i, { unit: e.target.value })}
                    className="h-9"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={d.quantity}
                    onChange={(e) => patch(i, { quantity: e.target.value })}
                    className="h-9"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.costPrice}
                    onChange={(e) => patch(i, { costPrice: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.unitPrice}
                    onChange={(e) => patch(i, { unitPrice: e.target.value })}
                    placeholder="0.00"
                    className="h-9"
                  />
                </td>
                <td className="p-2 text-right font-medium tabular-nums">
                  {formatZAR(n(d.quantity) * n(d.unitPrice))}
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={drafts.length === 1}
                    onClick={() => setDrafts((rows) => rows.filter((_, idx) => idx !== i))}
                    aria-label={`Remove line ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDrafts((d) => [...d, blank()])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add line
        </Button>

        {catalogue.length ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="from-shop" className="text-xs text-muted-foreground">
              From the shop
            </Label>
            <select
              id="from-shop"
              value=""
              onChange={(e) => {
                if (e.target.value) addFromCatalogue(e.target.value);
                e.target.value = "";
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Add a product…</option>
              {catalogue.map((c) => (
                <option key={`${c.slug}-${c.size}`} value={c.slug}>
                  {c.name} — {c.size}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <dl className="space-y-1 rounded-lg border p-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal (excl VAT)</dt>
            <dd className="font-medium tabular-nums">{formatZAR(totals.excl)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>VAT @ {(VAT_RATE * 100).toFixed(0)}%</dt>
            <dd className="font-medium tabular-nums">{formatZAR(totals.vat)}</dd>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <dt>Total (incl VAT)</dt>
            <dd className="tabular-nums">{formatZAR(totals.incl)}</dd>
          </div>
        </dl>

        <div className="rounded-lg border border-dashed p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your margin — not printed
          </p>
          {totals.anyCost ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatZAR(totals.margin)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totals.marginPct.toFixed(1)}% of the quoted value. Cost never
                appears on the pack or the CSV.
              </p>
            </>
          ) : (
            <p className="mt-1 text-muted-foreground">
              Enter cost prices to see your margin while you quote.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Save pricing
            </>
          )}
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/tenders/${tenderId}/pricing.csv`}>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Save before downloading — the CSV is generated from what is stored, not
        from what is on screen.
      </p>
    </div>
  );
}
