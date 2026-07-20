import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getProducts } from "@/lib/products";
import { isAdminRequest, passwordAuthConfigured } from "@/lib/admin-auth";
import { ProductForm } from "@/components/admin/product-form";
import { ProductList } from "@/components/admin/product-list";
import { LoginForm } from "@/components/admin/login-form";
import { LogoutButton } from "@/components/admin/logout-button";

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
    // Offer the password form only when it is actually configured; otherwise
    // there is no way in and saying so is clearer than a form that can't work.
    return (
      <div className="container py-16">
        <h1 className="mb-6 text-center font-display text-3xl font-extrabold">
          Admin
        </h1>
        {passwordAuthConfigured(env) ? (
          <LoginForm />
        ) : (
          <p className="mx-auto max-w-prose text-center text-muted-foreground">
            This page is not available. Admin sign-in has not been configured
            yet.
          </p>
        )}
      </div>
    );
  }

  const products = await getProducts();

  return (
    <div className="container max-w-4xl py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Admin</h1>
          <p className="mt-2 text-muted-foreground">
            Add products to the shop. Changes appear on the site immediately —
            no redeploy needed.
          </p>
        </div>
        <LogoutButton />
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
