"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import type { CompanyProfile } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** The spellings the eTenders feed uses; a mismatch here matches nothing. */
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

/**
 * Company particulars printed on every generated tender document.
 *
 * Separate from data/site.ts on purpose: those are shop-facing marketing
 * details, these are the legal ones a bid is judged on, and they must be
 * fixable without a redeploy.
 */
export function CompanyForm({ profile }: { profile: CompanyProfile }) {
  const router = useRouter();
  const [form, setForm] = React.useState<CompanyProfile>(profile);
  const [saving, setSaving] = React.useState(false);

  function set(field: keyof CompanyProfile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  const watched = form.alertProvinces
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  function toggleProvince(province: string, on: boolean) {
    const next = on
      ? [...watched, province]
      : watched.filter((p) => p !== province);
    // Stored in the listed order rather than the order they were clicked, so
    // the field reads the same however it was filled in.
    setForm((f) => ({
      ...f,
      alertProvinces: PROVINCES.filter((p) => next.includes(p)).join(", "),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      toast.success("Company details saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="legalName">Registered company name</Label>
          <Input
            id="legalName"
            value={form.legalName}
            onChange={set("legalName")}
            placeholder="Skrubb-it Products (Pty) Ltd"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradingName">Trading as</Label>
          <Input
            id="tradingName"
            value={form.tradingName}
            onChange={set("tradingName")}
            placeholder="Skrubb-it"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">CIPC registration number</Label>
          <Input
            id="registrationNumber"
            value={form.registrationNumber}
            onChange={set("registrationNumber")}
            placeholder="2019/123456/07"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vatNumber">VAT number</Label>
          <Input
            id="vatNumber"
            value={form.vatNumber}
            onChange={set("vatNumber")}
            placeholder="4123456789"
            disabled={!form.vatRegistered}
          />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={form.vatRegistered}
              onChange={(e) =>
                setForm((f) => ({ ...f, vatRegistered: e.target.checked }))
              }
            />
            We are registered for VAT
          </label>
          <p className="text-xs text-muted-foreground">
            Tick only if actually registered. Every pricing schedule adds 15%
            VAT when this is on — quoting VAT you cannot charge can invalidate
            a bid.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="physicalAddress">Physical address</Label>
          <Textarea
            id="physicalAddress"
            value={form.physicalAddress}
            onChange={set("physicalAddress")}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalAddress">Postal address</Label>
          <Textarea
            id="postalAddress"
            value={form.postalAddress}
            onChange={set("postalAddress")}
            rows={3}
            placeholder="Same as physical, if applicable"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signatoryName">Who signs the bid</Label>
          <Input
            id="signatoryName"
            value={form.signatoryName}
            onChange={set("signatoryName")}
            placeholder="G Rushway"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signatoryPosition">Their capacity</Label>
          <Input
            id="signatoryPosition"
            value={form.signatoryPosition}
            onChange={set("signatoryPosition")}
            placeholder="Director"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Telephone</Label>
          <Input id="phone" value={form.phone} onChange={set("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={form.website} onChange={set("website")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notifyEmail">Send deadline reminders to</Label>
        <Input
          id="notifyEmail"
          value={form.notifyEmail}
          onChange={set("notifyEmail")}
          placeholder="you@example.com, colleague@example.com"
          className="sm:max-w-lg"
        />
        <p className="text-xs text-muted-foreground">
          An inbox someone actually watches — separate several with commas, and
          everyone listed gets the same message. Warnings go out ten days, a
          week, 48 hours and 24 hours before closing, and before a compulsory
          briefing. Leave empty to fall back to the email above.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tell me about new tenders in</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVINCES.map((province) => (
            <label
              key={province}
              className="flex items-center gap-2 text-sm font-normal"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={watched.includes(province)}
                onChange={(e) => toggleProvince(province, e.target.checked)}
              />
              {province}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A daily digest of adverts newly published on eTenders in these
          provinces, sent to the address above. Tick nothing to switch it off —
          the deadline reminders above carry on either way.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileText">Company profile</Label>
        <Textarea
          id="profileText"
          value={form.profileText}
          onChange={set("profileText")}
          rows={6}
          placeholder="What the business does, how long it has traded, capacity, delivery footprint, notable clients…"
        />
        <p className="text-xs text-muted-foreground">
          Printed in the technical section of every pack. The guide advises
          tailoring it per tender — edit here, or adjust the printed copy.
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" /> Save company details
          </>
        )}
      </Button>
    </form>
  );
}
