import type { Metadata } from "next";

import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { LibraryManager } from "@/components/admin/library-manager";
import { listLibrary } from "@/lib/library";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Library",
  robots: { index: false, follow: false },
};

export default async function LibraryPage() {
  const gate = await adminGate();
  if (gate) return gate;

  const documents = await listLibrary();

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/library"
        title="Library"
        description="Technical data sheets, formulations and supplier price lists. Nothing here is ever attached to a quotation or a tender pack automatically — that is what keeps the formulations off a bid."
      />
      <LibraryManager documents={documents} />
    </div>
  );
}
