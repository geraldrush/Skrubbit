import type { Metadata } from "next";
import Link from "next/link";
import { Beaker, FileText, PackageCheck, Truck } from "lucide-react";

import { categories } from "@/data/products";
import { getProducts } from "@/lib/products";
import { getCompanyProfile } from "@/lib/company";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What we supply",
  description:
    "Cleaning chemicals, hygiene consumables, vehicle care and industrial degreasers manufactured and supplied in bulk from Vhembe, Limpopo.",
};

const capabilities = [
  {
    icon: Beaker,
    title: "We manufacture, not resell",
    body: "Cleaning products are blended from raw materials bought direct. That means we control the formulation, we can adjust strength for a specific job, and we can supply a material safety data sheet for anything we make.",
  },
  {
    icon: PackageCheck,
    title: "Bulk pack sizes",
    body: "The range is supplied in 5, 20 and 25 litre containers — the sizes a school, clinic, workshop or office actually consumes. Smaller pack sizes are quoted on request.",
  },
  {
    icon: Truck,
    title: "Delivered locally",
    body: "Delivery to site, including offloading, throughout Limpopo. Being based in Vhembe means no Gauteng freight in the price and no waiting on a long-distance courier for a repeat order.",
  },
  {
    icon: FileText,
    title: "Quoted, not just priced",
    body: "Contract and volume pricing is quoted per order against what you actually use. Where a requirement exceeds what we can produce in the time allowed, we say so at quotation stage.",
  },
];

/**
 * What the company can actually do, for a buyer sizing up a supplier.
 *
 * The shop answers "what does it cost"; this answers "can you supply us". The
 * range is read from the live catalogue so it cannot drift out of date as
 * products are added.
 */
export default async function CapabilitiesPage() {
  const [products, profile] = await Promise.all([getProducts(), getCompanyProfile()]);
  const byCategory = categories
    .map((c) => ({ ...c, items: products.filter((p) => p.category === c.id) }))
    .filter((c) => c.items.length);

  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="container py-14 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Capabilities
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            What we supply, and how
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {products.length} products across {byCategory.length} categories —
            cleaning chemicals, hygiene consumables, vehicle care and industrial
            degreasers, manufactured and delivered from Vhembe.
          </p>
        </div>
      </section>

      <section className="container py-14">
        <div className="grid gap-8 sm:grid-cols-2">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-1 h-6 w-6 shrink-0 text-accent" aria-hidden />
              <div>
                <h2 className="font-display text-xl font-bold">{title}</h2>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-secondary/40 py-14">
        <div className="container">
          <h2 className="font-display text-3xl font-extrabold">The range</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Everything below is supplied in 5, 20 and 25 litre packs.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {byCategory.map((c) => (
              <div key={c.id} className="rounded-xl border bg-background p-6">
                <h3 className="font-display text-lg font-bold">{c.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.blurb}</p>
                <ul className="mt-4 grid gap-1.5 text-sm">
                  {c.items.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/shop/${p.slug}`}
                        className="text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="rounded-xl border bg-background p-8">
          <h2 className="font-display text-2xl font-extrabold">
            Safety data and product information
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            A material safety data sheet is available for every product we
            manufacture, and accompanies any quotation that calls for one. Where
            a tender or supplier database requires product datasheets as part of
            the submission, ask and we will send them with the quotation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="accent">
              <Link href="/contact">Request a quotation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/public-sector">Supplier particulars</Link>
            </Button>
          </div>
          {profile.phone && (
            <p className="mt-4 text-sm text-muted-foreground">
              Or call {profile.phone}.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
