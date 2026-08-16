import type { Metadata } from "next";

import { listDocuments, sastToday } from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { DocumentManager } from "@/components/admin/document-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company documents",
  robots: { index: false, follow: false },
};

export default async function DocumentsPage() {
  const gate = await adminGate();
  if (gate) return gate;

  const documents = await listDocuments();

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/documents"
        title="Company documents"
        description="Your compliance register. Every tender checks these expiry dates against its own closing date, so a lapsed certificate is caught before it disqualifies a bid."
      />

      <p className="mb-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        This records <strong>details only</strong> — reference numbers, validity
        dates and where each file is kept. The documents themselves stay where
        they are; certified ID copies and tax documents are deliberately not
        stored here.
      </p>

      <DocumentManager documents={documents} today={sastToday()} />
    </div>
  );
}
