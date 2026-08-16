import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { TenderSearch } from "@/components/admin/tender-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find tenders",
  robots: { index: false, follow: false },
};

export default async function TenderSearchPage() {
  const gate = await adminGate();
  if (gate) return gate;

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/tenders/search"
        title="Find tenders"
        description="Live adverts from the National Treasury eTenders feed. Importing one fills in its dates, department and contact, and creates its compliance matrix."
      />

      <Link
        href="/admin/tenders"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to register
      </Link>

      <TenderSearch />

      <p className="mt-8 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
        Source: National Treasury eTenders OCDS API, published under a
        public-domain dedication. Closing times in the feed are stamped as UTC
        but are South African local times — they are corrected on import.{" "}
        <strong>Always confirm the deadline against the tender document</strong>{" "}
        before relying on it.
      </p>
    </div>
  );
}
