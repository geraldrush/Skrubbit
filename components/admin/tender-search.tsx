"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
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

interface SyncState {
  running: boolean;
  lastRunAt: string | null;
  lastSweepAt: string | null;
  recordsTotal: number;
  nextPage: number;
  status: string;
  message: string;
}

/** "3 hours ago" from a D1 `datetime('now')` stamp, which is UTC. */
function ago(stamp: string | null): string {
  if (!stamp) return "never";
  const t = Date.parse(`${stamp.replace(" ", "T")}Z`);
  if (Number.isNaN(t)) return stamp;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function SyncBar({
  sync,
  syncing,
  onSync,
}: {
  sync: SyncState | null;
  syncing: boolean;
  onSync: () => void;
}) {
  const running = syncing || sync?.running;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <div>
        <p className="font-medium">
          {sync?.recordsTotal ? `${sync.recordsTotal} tenders held locally` : "Nothing synced yet"}
        </p>
        <p className="text-xs text-muted-foreground">
          {running
            ? `Syncing… (page ${sync?.nextPage ?? 1}) — searching still works while this runs`
            : `Last checked ${ago(sync?.lastRunAt ?? null)} · full pass ${ago(
                sync?.lastSweepAt ?? null
              )}`}
          {sync?.message ? ` · ${sync.message}` : ""}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onSync} disabled={Boolean(running)}>
        {running ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Syncing
          </>
        ) : (
          <>
            <RefreshCw className="mr-1 h-4 w-4" /> Sync now
          </>
        )}
      </Button>
    </div>
  );
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
  // All types by default, so the count lines up with what etenders.gov.za
  // shows for the same province. Narrowing to goods is one click away.
  const [category, setCategory] = React.useState("");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [matched, setMatched] = React.useState(0);
  const [available, setAvailable] = React.useState(0);
  const [sync, setSync] = React.useState<SyncState | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [importing, setImporting] = React.useState<string | null>(null);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshSync = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tender-sync");
      if (!res.ok) return null;
      const state = (await res.json()) as SyncState;
      setSync(state);
      return state;
    } catch {
      return null;
    }
  }, []);

  // Poll only while a crawl is in flight, and stop as soon as it settles.
  React.useEffect(() => {
    if (!sync?.running && !syncing) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const state = await refreshSync();
      if (state && !state.running) setSyncing(false);
    }, 5000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sync?.running, syncing, refreshSync]);

  React.useEffect(() => {
    void refreshSync();
  }, [refreshSync]);

  async function startSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/tender-sync", { method: "POST" });
      if (!res.ok) throw new Error("Could not start the sync");
      toast.success("Sync started — this takes a few minutes against a slow feed");
      await refreshSync();
    } catch (err) {
      setSyncing(false);
      toast.error(err instanceof Error ? err.message : "Could not start the sync");
    }
  }

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
        matched?: number;
        available?: number;
        sync?: SyncState;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setRows(data.tenders ?? []);
      setMatched(data.matched ?? 0);
      setAvailable(data.available ?? 0);
      if (data.sync) setSync(data.sync);
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
      <SyncBar
        sync={sync}
        syncing={syncing}
        onSync={startSync}
      />

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
              <option value="">All types</option>
              <option value="goods">Goods — supply &amp; delivery</option>
              <option value="services">Services</option>
              <option value="works">Works / construction</option>
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
          Nothing matched.{" "}
          {available
            ? `${available} open tenders are held locally — try fewer keywords, or switch the type to “All types”.`
            : "Nothing has been synced yet. Run a sync above."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {matched} open {matched === 1 ? "tender" : "tenders"} matched
            {matched > rows.length ? `, showing the first ${rows.length}` : ""} ·{" "}
            {available} open in total.
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
