import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getProducts } from "@/lib/products";
import { isAdminRequest } from "@/lib/admin-auth";
import { ProductForm } from "@/components/admin/product-form";
import { ProductList } from "@/components/admin/product-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  // Keep the admin console out of search results even though Cloudflare
  // Access already blocks anonymous visitors.
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const { env } = getCloudflareContext();

  // Mirrors the API guard so the page fails closed too, rather than rendering
  // the catalogue to anyone who reaches it if Access is ever misconfigured.
  const h = await headers();
  const req = new Request("https://admin.local", { headers: h });
  if (!(await isAdminRequest(req, env))) {
    return (
      <div className="container py-16">
        <h1 className="font-display text-3xl font-extrabold">Admin</h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          This page is not available. It must be placed behind Cloudflare Access
          before it can be used.
        </p>
      </div>
    );
  }

  const products = await getProducts();

  return (
    <div className="container max-w-4xl py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-extrabold">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Add products to the shop. Changes appear on the site immediately — no
          redeploy needed.
        </p>
      </header>

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
