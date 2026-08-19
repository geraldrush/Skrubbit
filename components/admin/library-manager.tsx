"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Lock, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { LIBRARY_CATEGORIES, type LibraryDocument } from "@/lib/library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const fmtSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * The reference library.
 *
 * Nothing filed here is ever attached to a quotation or a tender pack
 * automatically — that is the whole reason it is separate from the compliance
 * documents. The confidential flag exists so a formulation book cannot be
 * mistaken for a datasheet at the moment somebody is in a hurry.
 */
export function LibraryManager({ documents }: { documents: LibraryDocument[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("datasheet");
  const [notes, setNotes] = React.useState("");
  const [confidential, setConfidential] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file first");
    if (!title.trim()) return toast.error("Give the document a title");

    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", title);
      body.set("category", category);
      body.set("notes", notes);
      body.set("confidential", String(confidential));
      const res = await fetch("/api/admin/library", { method: "POST", body });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(`${title} filed`);
      setTitle("");
      setNotes("");
      setConfidential(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc: LibraryDocument) {
    if (!confirm(`Delete “${doc.title}”? The stored file is deleted too.`)) return;
    const res = await fetch(`/api/admin/library/${doc.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      router.refresh();
    } else {
      toast.error("Could not delete");
    }
  }

  const grouped = LIBRARY_CATEGORIES.map((c) => ({
    ...c,
    items: documents.filter((d) => d.category === c.id),
  })).filter((c) => c.items.length);

  return (
    <div className="space-y-8">
      <form onSubmit={upload} className="space-y-4 rounded-lg border p-4">
        <h2 className="font-display text-lg font-bold">File a document</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lib-title">Title</Label>
            <Input
              id="lib-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Technical data sheets — full range"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lib-category">Category</Label>
            <select
              id="lib-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {LIBRARY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lib-notes">Notes</Label>
          <Textarea
            id="lib-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="What this is and when you would send it."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lib-file">File</Label>
          <Input
            id="lib-file"
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
          />
          <p className="text-xs text-muted-foreground">
            PDF, spreadsheet or image, up to 25 MB.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={confidential}
            onChange={(e) => setConfidential(e.target.checked)}
          />
          Confidential — never send this to a customer
        </label>

        <Button type="submit" disabled={busy} variant="accent">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload
        </Button>
      </form>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing filed yet.</p>
      ) : (
        grouped.map((group) => (
          <section key={group.id} className="space-y-3">
            <h2 className="font-display text-lg font-bold">{group.label}</h2>
            <ul className="divide-y rounded-lg border">
              {group.items.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      {doc.title}
                      {doc.confidential && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                          <Lock className="h-3 w-3" /> Confidential
                        </span>
                      )}
                    </p>
                    {doc.notes && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{doc.notes}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {doc.fileName} · {fmtSize(doc.fileSize)} · filed{" "}
                      {doc.uploadedAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/admin/library/${doc.id}`}>
                        <Download className="h-4 w-4" /> Download
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(doc)}
                      aria-label={`Delete ${doc.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
