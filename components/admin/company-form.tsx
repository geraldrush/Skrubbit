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
          />
          <p className="text-xs text-muted-foreground">
            Leave blank if not VAT registered.
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
