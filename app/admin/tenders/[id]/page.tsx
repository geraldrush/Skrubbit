import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";

import { getProducts } from "@/lib/products";
import { getCompanyProfile } from "@/lib/company";
import {
  assessTender,
  getPricing,
  getTender,
  listDocuments,
} from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { ReadinessPanel } from "@/components/admin/readiness-panel";
import { PricingEditor } from "@/components/admin/pricing-editor";
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

  const [loaded, documents, pricing, products, profile] = await Promise.all([
    getTender(id),
    listDocuments(),
    getPricing(id),
    getProducts(),
    getCompanyProfile(),
  ]);
  if (!loaded) notFound();

  const { tender, items } = loaded;
  const issues = assessTender(tender, items, documents);

  // Flattened to one option per size, since a pricing line quotes a specific
  // pack size rather than a product in the abstract.
  const catalogue = products.flatMap((p) =>
    p.variants.map((v) => ({
      slug: p.slug,
      name: p.name,
      size: v.size,
      price: v.price,
    }))
  );

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
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/tenders/${tender.id}/pack`}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-secondary"
          >
            <FileText className="mr-1.5 h-4 w-4" /> Tender pack
          </Link>
          <DeleteTenderButton id={tender.id} title={tender.title} />
        </div>
      </div>

      <section className="mb-8">
        <ReadinessPanel issues={issues} />
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-display text-xl font-bold">Pricing schedule</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Quoted per bid. Lines are free-form — the shop catalogue can seed one,
          but tender pricing is your own.
        </p>
        <PricingEditor
          tenderId={tender.id}
          lines={pricing}
          catalogue={catalogue}
          vatRegistered={profile.vatRegistered}
        />
      </section>

      <TenderForm tender={tender} items={items} />
    </div>
  );
}
