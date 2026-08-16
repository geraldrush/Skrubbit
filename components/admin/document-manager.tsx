"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Paperclip, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  DOCUMENT_KIND_LABELS,
  type CompanyDocument,
  type DocumentKind,
} from "@/lib/tenders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The "master folder" from the guide, as metadata.
 *
 * Deliberately holds no files: certified ID copies and tax documents are not
 * stored by this app, only their validity dates, reference numbers and where
 * the real file is kept.
 *
 * `today` is supplied by the server rather than read from the browser clock so
 * expiry badges render identically on both sides and don't trip hydration.
 */

const KINDS = Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[];

function expiryState(expiresOn: string | null, today: string) {
  if (!expiresOn) return { label: "No expiry", tone: "text-muted-foreground" };
  if (expiresOn < today) return { label: `Expired ${expiresOn}`, tone: "text-destructive font-semibold" };
  const soon = new Date(`${today}T12:00:00+02:00`);
  soon.setDate(soon.getDate() + 30);
  if (new Date(`${expiresOn}T12:00:00+02:00`) <= soon) {
    return { label: `Expires ${expiresOn}`, tone: "text-amber-700 dark:text-amber-500 font-semibold" };
  }
  return { label: `Valid to ${expiresOn}`, tone: "text-muted-foreground" };
}

interface Draft {
  kind: DocumentKind;
  label: string;
  reference: string;
  issuedOn: string;
  expiresOn: string;
  bbbeeLevel: string;
  location: string;
  notes: string;
}

const emptyDraft = (): Draft => ({
  kind: "cipc",
  label: "",
  reference: "",
  issuedOn: "",
  expiresOn: "",
  bbbeeLevel: "",
  location: "",
  notes: "",
});

const toDraft = (d: CompanyDocument): Draft => ({
  kind: d.kind,
  label: d.label,
  reference: d.reference,
  issuedOn: d.issuedOn ?? "",
  expiresOn: d.expiresOn ?? "",
  bbbeeLevel: d.bbbeeLevel ? String(d.bbbeeLevel) : "",
  location: d.location,
  notes: d.notes,
});

function DocumentFields({
  draft,
  set,
  onSubmit,
  onCancel,
  busy,
  submitLabel,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4 rounded-lg border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Document type</Label>
          <select
            value={draft.kind}
            onChange={(e) => {
              const kind = e.target.value as DocumentKind;
              // Prefill the label so the common case is one less field.
              set({ kind, label: draft.label || DOCUMENT_KIND_LABELS[kind] });
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Label</Label>
          <Input
            value={draft.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="SARS Tax Compliance PIN"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Reference number</Label>
          <Input
            value={draft.reference}
            onChange={(e) => set({ reference: e.target.value })}
            placeholder="MAAA1234567"
          />
        </div>
        <div className="space-y-2">
          <Label>Issued</Label>
          <Input
            type="date"
            value={draft.issuedOn}
            onChange={(e) => set({ issuedOn: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Expires</Label>
          <Input
            type="date"
            value={draft.expiresOn}
            onChange={(e) => set({ expiresOn: e.target.value })}
          />
        </div>
      </div>

      {draft.kind === "bbbee" ? (
        <div className="space-y-2">
          <Label>B-BBEE contribution level</Label>
          <select
            value={draft.bbbeeLevel}
            onChange={(e) => set({ bbbeeLevel: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-64"
          >
            <option value="">Choose a level</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            What a tender may claim on SBD 6.1 is checked against this.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Where the file is kept</Label>
          <Input
            value={draft.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Drive › Compliance › 2026"
          />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={1}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> {submitLabel}
            </>
          )}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Upload / view / remove the stored certificate for one document.
 *
 * Files go to R2 under `documents/` and are readable only through the
 * admin-gated download route — never the public image path.
 */
function FileControl({ doc, busy, setBusy }: {
  doc: CompanyDocument;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/documents/${doc.id}/file`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Certificate uploaded");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile() {
    if (!window.confirm(`Remove the uploaded file for "${doc.label}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/file`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove the file");
      toast.success("File removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      {doc.fileKey ? (
        <>
          <a
            href={`/api/admin/documents/${doc.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline hover:text-accent"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {doc.fileName || "View file"}
          </a>
          <span className="text-muted-foreground">
            {(doc.fileSize / 1024).toFixed(0)} KB
          </span>
          <button
            type="button"
            onClick={removeFile}
            disabled={busy}
            className="text-muted-foreground underline hover:text-destructive"
          >
            remove
          </button>
        </>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <FileUp className="h-3.5 w-3.5" /> No file uploaded
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
        className="max-w-[13rem] text-xs file:mr-2 file:rounded file:border file:bg-secondary file:px-2 file:py-1 file:text-xs"
      />
    </div>
  );
}

export function DocumentManager({
  documents,
  today,
}: {
  documents: CompanyDocument[];
  today: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [busy, setBusy] = React.useState(false);

  function payload(d: Draft) {
    return {
      ...d,
      issuedOn: d.issuedOn || null,
      expiresOn: d.expiresOn || null,
      bbbeeLevel: d.bbbeeLevel === "" ? null : Number(d.bbbeeLevel),
    };
  }

  async function save(url: string, method: "POST" | "PUT") {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(draft)),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      toast.success("Saved");
      setAdding(false);
      setEditing(null);
      setDraft(emptyDraft());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc: CompanyDocument) {
    if (!window.confirm(`Remove "${doc.label}" from the register?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      toast.success("Removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {documents.length ? (
        <ul className="divide-y rounded-lg border">
          {documents.map((doc) => {
            const state = expiryState(doc.expiresOn, today);
            if (editing === doc.id) {
              return (
                <li key={doc.id} className="p-3">
                  <DocumentFields
                    draft={draft}
                    set={(p) => setDraft((d) => ({ ...d, ...p }))}
                    onSubmit={() => save(`/api/admin/documents/${doc.id}`, "PUT")}
                    onCancel={() => setEditing(null)}
                    busy={busy}
                    submitLabel="Save changes"
                  />
                </li>
              );
            }
            return (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_KIND_LABELS[doc.kind]}
                    {doc.reference ? ` · ${doc.reference}` : ""}
                    {doc.bbbeeLevel ? ` · Level ${doc.bbbeeLevel}` : ""}
                    {doc.location ? ` · ${doc.location}` : ""}
                  </p>
                  <FileControl doc={doc} busy={busy} setBusy={setBusy} />
                </div>
                <span className={`text-sm ${state.tone}`}>{state.label}</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdding(false);
                      setEditing(doc.id);
                      setDraft(toDraft(doc));
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => remove(doc)}
                    aria-label={`Remove ${doc.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nothing recorded yet. Add your CSD report, Tax PIN, CIPC documents and
          B-BBEE certificate so expiries are checked against every tender.
        </p>
      )}

      {adding ? (
        <DocumentFields
          draft={draft}
          set={(p) => setDraft((d) => ({ ...d, ...p }))}
          onSubmit={() => save("/api/admin/documents", "POST")}
          onCancel={() => setAdding(false)}
          busy={busy}
          submitLabel="Add document"
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setDraft(emptyDraft());
            setAdding(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add a document
        </Button>
      )}
    </div>
  );
}
