"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/tenders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Search live eTenders adverts and import them in one click.
 *
 * The feed can only filter by date, so keyword/province/category narrowing
 * happens server-side after fetching — which is why a search is one request
 * rather than a live-as-you-type filter.
 */

interface Row {
  ocid: string;
  reference: string;
  title: string;
  department: string;
  closingAt: string | null;
  briefingAt: string | null;
  briefingCompulsory: boolean;
  province: string;
  category: string;
  documents: { title: string; url: string }[];
  imported: boolean;
}

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "National",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);
}

export function TenderSearch() {
  const router = useRouter();
  const [keyword, setKeyword] = React.useState("");
  const [province, setProvince] = React.useState("");
  // Goods by default: the business is supplying and delivering things, and
  // services/works adverts would otherwise drown that out.
  const [category, setCategory] = React.useState("goods");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [scanned, setScanned] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [importing, setImporting] = React.useState<string | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set("q", keyword);
      if (province) params.set("province", province);
      if (category) params.set("category", category);
      const res = await fetch(`/api/admin/tender-search?${params}`);
      const data = (await res.json()) as {
        tenders?: Row[];
        scanned?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setRows(data.tenders ?? []);
      setScanned(data.scanned ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function importTender(row: Row) {
    setImporting(row.ocid);
    try {
      const res = await fetch("/api/admin/tenders/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ocid: row.ocid }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast.success("Imported — compliance matrix created");
      setRows((rs) =>
        rs ? rs.map((r) => (r.ocid === row.ocid ? { ...r, imported: true } : r)) : rs
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={search} className="space-y-4 rounded-lg border p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="q">Keywords</Label>
            <Input
              id="q"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="detergent, supply, delivery…"
            />
            <p className="text-xs text-muted-foreground">
              All words must appear. Leave empty to see everything.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <select
              id="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className={selectClass}
            >
              <option value="">All provinces</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Type</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              <option value="goods">Goods — supply &amp; delivery</option>
              <option value="services">Services</option>
              <option value="works">Works / construction</option>
              <option value="">All types</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching…
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" /> Search eTenders
            </>
          )}
        </Button>
      </form>

      {rows === null ? null : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nothing open matched. {scanned} adverts from the last 60 days were
          checked — try fewer keywords, or switch the type to “All types”.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} open {rows.length === 1 ? "tender" : "tenders"} from{" "}
            {scanned} recent adverts.
          </p>
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => {
              const days = row.closingAt ? daysUntil(row.closingAt) : null;
              return (
                <li key={row.ocid} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{row.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.reference} · {row.department}
                        {row.province ? ` · ${row.province}` : ""}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {row.closingAt ? (
                          <span>
                            Closes {formatDateTime(row.closingAt)}
                            {days !== null ? (
                              <span
                                className={
                                  days <= 7
                                    ? " font-semibold text-[#b02a2a] dark:text-[#d03b3b]"
                                    : " text-muted-foreground"
                                }
                              >
                                {" "}
                                · {days} {days === 1 ? "day" : "days"} left
                              </span>
                            ) : null}
                          </span>
                        ) : null}

                        {row.briefingCompulsory ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#8a5a00] dark:text-[#fab219]">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Compulsory briefing
                            {row.briefingAt ? ` ${formatDateTime(row.briefingAt)}` : ""}
                          </span>
                        ) : null}

                        {row.documents[0] ? (
                          <a
                            href={row.documents[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 underline hover:text-accent"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Tender document
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {row.imported ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#006300] dark:text-[#0ca30c]">
                          <Check className="h-4 w-4" /> In register
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={importing === row.ocid}
                          onClick={() => importTender(row)}
                        >
                          {importing === row.ocid ? (
                            <>
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Importing…
                            </>
                          ) : (
                            <>
                              <Download className="mr-1 h-4 w-4" /> Import
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
