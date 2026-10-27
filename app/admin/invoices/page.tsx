import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getCompanyProfile } from "@/lib/company";
import { getRecentOrders } from "@/lib/enquiries";
import { listCustomers, listInvoices } from "@/lib/invoices";
import { emailConfigured } from "@/lib/notify";
import { getProducts } from "@/lib/products";
import { listTenders, sastToday } from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { InvoicesApp } from "@/components/admin/invoices-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};

/**
 * Quotes, invoices, payments and customers.
 *
 * Everything the screen needs is loaded here, once. From then on the client
 * component works against /api/admin/invoices one record at a time, so this
 * page is the only full load however much is done on it.
 */
export default async function InvoicesPage() {
  const gate = await adminGate();
  if (gate) return gate;

  const { env } = getCloudflareContext();
  const [profile, customers, invoices, products, tenders, orders] = await Promise.all([
    getCompanyProfile(),
    listCustomers(),
    listInvoices(),
    getProducts(),
    listTenders(),
    getRecentOrders(30),
  ]);

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/invoices"
        title="Invoices"
        description="Quote, invoice, and see who has paid. PDFs carry your letterhead and banking details."
      />
      <InvoicesApp
        today={sastToday()}
        vatRegistered={profile.vatRegistered}
        hasBankDetails={Boolean(profile.bankDetails.trim())}
        emailReady={emailConfigured(env)}
        customers={customers}
        invoices={invoices}
        catalogue={products.flatMap((p) =>
          p.variants.map((v) => ({ name: p.name, size: v.size, price: v.price }))
        )}
        // Only tenders that can still turn into a bill.
        tenders={tenders
          .filter((t) => t.status === "won" || t.status === "submitted")
          .map((t) => ({ id: t.id, reference: t.reference, title: t.title, department: t.department }))}
        orders={orders.map((o) => ({
          reference: o.reference,
          name: o.name,
          email: o.email,
          phone: o.phone,
          address: o.address,
          items: o.items,
        }))}
      />
    </div>
  );
}
