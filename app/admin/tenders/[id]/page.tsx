import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  assessTender,
  getTender,
  listDocuments,
} from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { ReadinessPanel } from "@/components/admin/readiness-panel";
import { DeleteTenderButton, TenderForm } from "@/components/admin/tender-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tender",
  robots: { index: false, follow: false },
};

export default async function TenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await adminGate();
  if (gate) return gate;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [loaded, documents] = await Promise.all([getTender(id), listDocuments()]);
  if (!loaded) notFound();

  const { tender, items } = loaded;
  const issues = assessTender(tender, items, documents);

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav current="/admin/tenders" title={tender.title} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/admin/tenders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
        >
          <ChevronLeft className="h-4 w-4" /> All tenders
        </Link>
        <DeleteTenderButton id={tender.id} title={tender.title} />
      </div>

      <section className="mb-8">
        <ReadinessPanel issues={issues} />
      </section>

      <TenderForm tender={tender} items={items} />
    </div>
  );
}
