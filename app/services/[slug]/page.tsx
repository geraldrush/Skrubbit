import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

import { getService, serviceGroups, services } from "@/data/services";
import { site } from "@/data/site";
import { BUSINESS_ID, absoluteUrl, areaServed, breadcrumbSchema } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";

// The footer reads the company record from D1, as on every other page.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: "Service not found" };
  return {
    title: `${service.name} in Limpopo`,
    description: `${service.summary} Professional ${service.name.toLowerCase()} by Skrubb-it across Limpopo — request a free quote.`,
    alternates: { canonical: `/services/${service.slug}` },
  };
}

const steps = [
  "Tell us about the premises and what needs cleaning.",
  "We confirm the scope — on site if needed — and send a written quote.",
  "A crew sized to the job arrives with our own equipment and chemicals.",
  "You check the result before we sign the job off.",
];

/**
 * One page per service, so each can be found on its own in search — somebody
 * looking for "post-construction cleaning Limpopo" should land here, not on a
 * long list where the service is one card among twenty.
 */
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const group = serviceGroups.find((g) => g.id === service.group);
  const related = services.filter(
    (s) => s.group === service.group && s.slug !== service.slug
  );

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    serviceType: service.name,
    description: service.summary,
    url: absoluteUrl(`/services/${service.slug}`),
    provider: { "@id": BUSINESS_ID },
    areaServed,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${service.name} — what's included`,
      itemListElement: service.includes.map((item) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: item },
      })),
    },
  };

  return (
    <>
      <JsonLd data={serviceSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Cleaning services", path: "/services" },
          { name: service.name, path: `/services/${service.slug}` },
        ])}
      />

      <section className="border-b bg-secondary/40">
        <div className="container py-12 md:py-16">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-1 text-sm text-muted-foreground"
          >
            <Link href="/services" className="hover:text-accent">
              Cleaning services
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{service.name}</span>
          </nav>
          {group && (
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">
              {group.name}
            </p>
          )}
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {service.name} in Limpopo
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {service.summary}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href={`/contact?service=${service.slug}`}>
                Get a free quote
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href={`https://wa.me/${site.contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp us
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="container grid gap-12 py-14 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            What&apos;s included
          </h2>
          <ul className="mt-5 grid gap-3">
            {service.includes.map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-muted-foreground">
            The exact scope is agreed before we quote, so anything specific to
            your premises can be added or left out.
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold">How it works</h2>
          <ol className="mt-5 grid gap-4">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent font-display font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t bg-secondary/40 py-14">
        <div className="container">
          <h2 className="font-display text-2xl font-extrabold">
            Why Skrubb-it
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            We manufacture cleaning chemicals in Vhembe and clean with our own
            products, so the right strength is always on hand. We are a
            registered, CSD-listed, B-BBEE Level 1 company serving homes,
            businesses, schools, clinics and government across Limpopo.
          </p>
          {related.length > 0 && (
            <>
              <h3 className="mt-10 font-display text-lg font-bold">
                Related services
              </h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {related.map((s) => (
                  <Button key={s.slug} asChild variant="outline" size="sm">
                    <Link href={`/services/${s.slug}`}>{s.name}</Link>
                  </Button>
                ))}
                <Button asChild variant="link" size="sm">
                  <Link href="/services">All services</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
