import type { Metadata } from "next";

import { listDocuments, sastToday } from "@/lib/tenders";
import { getCompanyProfile } from "@/lib/company";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { CompanyForm } from "@/components/admin/company-form";
import { DocumentManager } from "@/components/admin/document-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company documents",
  robots: { index: false, follow: false },
};

export default async function DocumentsPage() {
  const gate = await adminGate();
  if (gate) return gate;

  const [documents, profile] = await Promise.all([
    listDocuments(),
    getCompanyProfile(),
  ]);

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/documents"
        title="Company documents"
        description="Your compliance register. Every tender checks these expiry dates against its own closing date, so a lapsed certificate is caught before it disqualifies a bid."
      />

      <p className="mb-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        Reference numbers and validity dates, and — where you upload one — the
        certificate itself. <strong>Uploaded files are stored privately</strong>:
        they sit behind this admin login, are never served on a public URL, and
        are excluded from search engines and shared caches. They are attached to
        the generated tender pack and to the enclosures download, so a bid can
        be assembled and printed from one place.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">Compliance register</h2>
        <DocumentManager documents={documents} today={sastToday()} />
      </section>

      <section>
        <h2 className="mb-1 font-display text-xl font-bold">Company details</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Printed on every generated cover letter, company profile and pricing
          schedule.
        </p>
        <CompanyForm profile={profile} />
      </section>
    </div>
  );
}
