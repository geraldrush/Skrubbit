"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { TENDER_FILE_LABELS, type TenderFile, type TenderFileKind } from "@/lib/tenders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The tender's own paperwork, kept with the bid instead of in an email thread.
 *
 * Separate from the compliance register: those are company certificates reused
 * across every bid, these belong to this tender only.
 */

const KINDS = Object.keys(TENDER_FILE_LABELS) as TenderFileKind[];

export function TenderFiles({
  tenderId,
  files,
}: {
  tenderId: number;
  files: TenderFile[];
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<TenderFileKind>("tender_document");
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("label", label);
      const res = await fetch(`/api/admin/tenders/${tenderId}/files`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Saved to this tender");
      setLabel("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(file: TenderFile) {
    if (!window.confirm(`Remove "${file.label || file.fileName}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tenders/${tenderId}/files/${file.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove it");
      toast.success("Removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove it");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {files.length ? (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/admin/tenders/${tenderId}/files/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline hover:text-accent"
                >
                  {f.label || f.fileName}
                </a>
                <p className="text-xs text-muted-foreground">
                  {TENDER_FILE_LABELS[f.kind]} · {f.fileName} ·{" "}
                  {(f.fileSize / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={() => remove(f)}
                aria-label={`Remove ${f.label || f.fileName}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing kept for this tender yet. The advert, the blank official forms
          and any addendum are the ones worth having here.
        </p>
      )}

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="space-y-2">
          <Label htmlFor="file-kind">What is it</Label>
          <select
            id="file-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as TenderFileKind)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {TENDER_FILE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file-label">Label (optional)</Label>
          <Input
            id="file-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Addendum 1 — closing date extended"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
              className="max-w-[18rem] text-xs file:mr-2 file:rounded file:border file:bg-secondary file:px-2 file:py-1 file:text-xs"
            />
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            PDF or image, up to 25 MB. Stored privately, behind this login.
          </p>
        </div>
      </div>
    </div>
  );
}
