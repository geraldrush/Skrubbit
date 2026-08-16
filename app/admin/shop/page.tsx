import type { Metadata } from "next";

import { getProducts } from "@/lib/products";
import { getRecentContactMessages, getRecentOrders } from "@/lib/enquiries";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { ProductForm } from "@/components/admin/product-form";
import { ProductList } from "@/components/admin/product-list";
import { MessageList, OrderList } from "@/components/admin/enquiries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  // Keep the admin console out of search results even though Cloudflare
  // Access already blocks anonymous visitors.
  robots: { index: false, follow: false },
};

export default async function ShopAdminPage() {
  // Guard runs before any query, so nothing is loaded for anonymous visitors.
  const gate = await adminGate();
  if (gate) return gate;

  const [products, orders, messages] = await Promise.all([
    getProducts(),
    getRecentOrders(),
    getRecentContactMessages(),
  ]);

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/shop"
        title="Shop"
        description="Orders, enquiries and the product catalogue. Changes appear on the site immediately — no redeploy needed."
      />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Recent orders ({orders.length})
        </h2>
        <OrderList orders={orders} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Messages ({messages.length})
        </h2>
        <MessageList messages={messages} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Current products ({products.length})
        </h2>
        <ProductList products={products} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Add a product</h2>
        <ProductForm />
      </section>
    </div>
  );
}
