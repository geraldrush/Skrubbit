"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ItemCategory,
  type Tender,
  type TenderItem,
} from "@/lib/tenders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLES } from "@/lib/pack-templates";

/**
 * Create or edit a tender, with its compliance matrix when editing.
 *
 * The matrix saves with the rest of the form in one request rather than a
 * write per tick — a 24-row checklist would otherwise be 24 round trips, and a
 * half-saved matrix would make the readiness panel lie.
 */

/** "2026-09-01T11:00:00+02:00" -> "2026-09-01T11:00" for datetime-local. */
function toLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

interface Draft {
  attached: boolean;
  signed: boolean;
  required: boolean;
  note: string;
}

export function TenderForm({
  tender,
  items = [],
}: {
  tender?: Tender;
  items?: TenderItem[];
}) {
  const router = useRouter();
  const isEdit = Boolean(tender);

  const [reference, setReference] = React.useState(tender?.reference ?? "");
  const [title, setTitle] = React.useState(tender?.title ?? "");
  const [department, setDepartment] = React.useState(tender?.department ?? "");
  const [description, setDescription] = React.useState(tender?.description ?? "");
  const [closingAt, setClosingAt] = React.useState(toLocalInput(tender?.closingAt ?? null));
  const [briefingAt, setBriefingAt] = React.useState(toLocalInput(tender?.briefingAt ?? null));
  const [briefingCompulsory, setBriefingCompulsory] = React.useState(
    tender?.briefingCompulsory ?? false
  );
  const [briefingAttended, setBriefingAttended] = React.useState(
    tender?.briefingAttended ?? false
  );
  const [submissionMethod, setSubmissionMethod] = React.useState(
    tender?.submissionMethod ?? "physical"
  );
  const [submissionDetail, setSubmissionDetail] = React.useState(
    tender?.submissionDetail ?? ""
  );
  const [bbbeeClaimedLevel, setBbbeeClaimedLevel] = React.useState(
    tender?.bbbeeClaimedLevel ? String(tender.bbbeeClaimedLevel) : ""
  );
  const [status, setStatus] = React.useState(tender?.status ?? "preparing");
  const [notes, setNotes] = React.useState(tender?.notes ?? "");
  const [profileOverride, setProfileOverride] = React.useState(
    tender?.profileOverride ?? ""
  );
  const [methodology, setMethodology] = React.useState(tender?.methodology ?? "");
  const [experience, setExperience] = React.useState(tender?.experience ?? "");
  const [saving, setSaving] = React.useState(false);

  const [drafts, setDrafts] = React.useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        { attached: i.attached, signed: i.signed, required: i.required, note: i.note },
      ])
    )
  );

  function patch(id: number, change: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...change } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        reference,
        title,
        department,
        description,
        closingAt,
        briefingAt,
        briefingCompulsory,
        briefingAttended,
        submissionMethod,
        submissionDetail,
        bbbeeClaimedLevel: bbbeeClaimedLevel === "" ? null : Number(bbbeeClaimedLevel),
        status,
        notes,
        profileOverride,
        methodology,
        experience,
        items: items.map((i) => ({ id: i.id, ...drafts[i.id] })),
      };

      const res = await fetch(
        isEdit ? `/api/admin/tenders/${tender!.id}` : "/api/admin/tenders",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as { error?: string; id?: number };
      if (!res.ok) throw new Error(data.error ?? "Could not save");

      toast.success(isEdit ? "Tender saved" : `${title} added`);
      if (!isEdit && data.id) router.push(`/admin/tenders/${data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const byCategory = React.useMemo(() => {
    const map = new Map<ItemCategory, TenderItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4 rounded-lg border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="reference">Tender reference</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="RFQ 123/2026"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department / entity</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Department of Public Works"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Supply and delivery of cleaning chemicals"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Scope / description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="closingAt">Closing date &amp; time</Label>
            <Input
              id="closingAt"
              type="datetime-local"
              value={closingAt}
              onChange={(e) => setClosingAt(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              South African time. One minute late is a rejection.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="briefingAt">Briefing session</Label>
            <Input
              id="briefingAt"
              type="datetime-local"
              value={briefingAt}
              onChange={(e) => setBriefingAt(e.target.value)}
            />
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={briefingCompulsory}
                  onChange={(e) => setBriefingCompulsory(e.target.checked)}
                />
                Compulsory
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={briefingAttended}
                  onChange={(e) => setBriefingAttended(e.target.checked)}
                />
                Attended
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="submissionMethod">Submission method</Label>
            <select
              id="submissionMethod"
              value={submissionMethod}
              onChange={(e) =>
                setSubmissionMethod(e.target.value as "physical" | "electronic")
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="physical">Physical tender box</option>
              <option value="electronic">Electronic portal</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="submissionDetail">
              {submissionMethod === "physical" ? "Tender box address" : "Portal"}
            </Label>
            <Input
              id="submissionDetail"
              value={submissionDetail}
              onChange={(e) => setSubmissionDetail(e.target.value)}
              placeholder={
                submissionMethod === "physical"
                  ? "Ground floor, 12 Church Street"
                  : "https://…"
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bbbee">B-BBEE level claimed on SBD 6.1</Label>
            <select
              id="bbbee"
              value={bbbeeClaimedLevel}
              onChange={(e) => setBbbeeClaimedLevel(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Not claiming preference points</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Checked against your B-BBEE certificate. Overclaiming disqualifies.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Tender["status"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="preparing">Preparing</option>
              <option value="submitted">Submitted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </section>

      {isEdit ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold">Compliance matrix</h2>
            <p className="text-sm text-muted-foreground">
              Every document and signature the bid needs. Untick anything this
              tender doesn&apos;t ask for, and note &quot;N/A&quot; rather than
              leaving a row undecided.
            </p>
          </div>

          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
            <div key={category} className="rounded-lg border">
              <h3 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="divide-y">
                {(byCategory.get(category) ?? []).map((item) => {
                  const d = drafts[item.id];
                  if (!d) return null;
                  return (
                    <li key={item.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <p
                          className={
                            d.required ? "font-medium" : "font-medium text-muted-foreground"
                          }
                        >
                          {item.label}
                        </p>
                        <Input
                          value={d.note}
                          onChange={(e) => patch(item.id, { note: e.target.value })}
                          placeholder={d.required ? "Note (optional)" : 'e.g. "N/A — not construction"'}
                          className="mt-1.5 h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-start gap-4 text-sm sm:pl-4">
                        <label className="flex items-center gap-1.5 font-medium">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={d.required}
                            onChange={(e) => patch(item.id, { required: e.target.checked })}
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-1.5 font-medium">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={d.attached}
                            onChange={(e) => patch(item.id, { attached: e.target.checked })}
                          />
                          Attached
                        </label>
                        {item.signatureRequired ? (
                          <label className="flex items-center gap-1.5 font-medium">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border"
                              checked={d.signed}
                              onChange={(e) => patch(item.id, { signed: e.target.checked })}
                            />
                            Signed
                          </label>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ) : null}


      {isEdit ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold">Written sections</h2>
            <p className="text-sm text-muted-foreground">
              These are printed in the pack and are where functionality points
              are won. “Insert sample” fills the box with a worked example
              showing the expected depth — replace it with your own wording; a
              pack never prints template text on its own.
            </p>
          </div>

          <WrittenSection
            id="profileOverride"
            label="Company profile for this tender"
            hint="Leave empty to use the standard profile from Documents."
            value={profileOverride}
            onChange={setProfileOverride}
            sample={SAMPLES.profile}
          />
          <WrittenSection
            id="methodology"
            label="Methodology / work plan"
            hint="How you will actually execute this contract, step by step."
            value={methodology}
            onChange={setMethodology}
            sample={SAMPLES.methodology}
          />
          <WrittenSection
            id="experience"
            label="Relevant experience"
            hint="Similar contracts completed, with contactable references."
            value={experience}
            onChange={setExperience}
            sample={SAMPLES.experience}
          />
        </section>
      ) : null}

      <Button type="submit" disabled={saving} size="lg">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : isEdit ? (
          <>
            <Save className="mr-2 h-4 w-4" /> Save tender
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" /> Add tender
          </>
        )}
      </Button>
    </form>
  );
}

function WrittenSection({
  id,
  label,
  hint,
  value,
  onChange,
  sample,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  sample: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            // Never silently discard writing already done.
            if (
              value.trim() &&
              !window.confirm("Replace what is written here with the sample?")
            ) {
              return;
            }
            onChange(sample);
          }}
        >
          <FileText className="mr-1 h-4 w-4" /> Insert sample
        </Button>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function DeleteTenderButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tenders/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      toast.success("Tender deleted");
      router.push("/admin/tenders");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
      <Trash2 className="mr-1 h-4 w-4" /> Delete
    </Button>
  );
}
