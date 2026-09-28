import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Beaker,
  CalendarClock,
  Check,
  ClipboardList,
  Users,
} from "lucide-react";

import { serviceGroups, services } from "@/data/services";
import { Button } from "@/components/ui/button";

// The footer reads the company record from D1, as on every other page.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Professional Cleaning Services in Limpopo",
  alternates: { canonical: "/services" },
  description:
    "Professional cleaning services from Skrubb-it in Limpopo: deep cleaning, heavy-duty, industrial, corporate and office cleaning, post-construction, sanitising, carpet, floor care, pressure washing and more.",
};

const approach = [
  {
    icon: Beaker,
    title: "Our own chemicals",
    body: "We clean with products we manufacture, so the right strength is always on hand and the chemicals are not a line item we mark up.",
  },
  {
    icon: ClipboardList,
    title: "Scoped before we quote",
    body: "We agree what is being cleaned, how and to what standard before a price is given, so the quote matches the job.",
  },
  {
    icon: Users,
    title: "Crews sized to the job",
    body: "A single cleaner for a flat, a full team for a warehouse or a school holiday deep clean.",
  },
  {
    icon: CalendarClock,
    title: "Once-off or on contract",
    body: "Book a single clean, or set up a regular schedule at a fixed monthly price. After-hours and weekend work by arrangement.",
  },
];

/**
 * The services side of the business, alongside the products.
 *
 * Every card links to /contact with the service pre-filled, because a buyer who
 * has found the right service should not have to describe it again.
 */
export default function ServicesPage() {
  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="container py-14 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Cleaning services
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Professional cleaning, done with our own products
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            From a one-off deep clean to a daily office contract, heavy-duty
            and industrial work, we clean homes, workplaces, schools and
            facilities across Limpopo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/contact?service=general">
                Request a cleaning quote
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#services">See all services</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="grid gap-8 sm:grid-cols-2">
          {approach.map(({ icon: Icon, title, body }) => (
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

      <div id="services" className="scroll-mt-20">
        {serviceGroups.map((g, i) => (
          <section
            key={g.id}
            id={g.id}
            className={`scroll-mt-20 border-t py-14 ${
              i % 2 === 0 ? "bg-secondary/40" : ""
            }`}
          >
            <div className="container">
              <h2 className="font-display text-3xl font-extrabold">{g.name}</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">{g.blurb}</p>
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {services
                  .filter((s) => s.group === g.id)
                  .map((s) => (
                    <article
                      key={s.slug}
                      id={s.slug}
                      className="flex scroll-mt-20 flex-col rounded-xl border bg-background p-6"
                    >
                      <h3 className="font-display text-lg font-bold">
                        <Link
                          href={`/services/${s.slug}`}
                          className="hover:text-accent"
                        >
                          {s.name}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {s.summary}
                      </p>
                      <ul className="mt-4 grid gap-1.5 text-sm">
                        {s.includes.map((item) => (
                          <li key={item} className="flex gap-2">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto flex flex-wrap gap-2 pt-6">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/contact?service=${s.slug}`}>
                            Get a quote
                          </Link>
                        </Button>
                        <Button asChild variant="link" size="sm">
                          <Link href={`/services/${s.slug}`}>
                            More about {s.name.toLowerCase()}
                          </Link>
                        </Button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="container py-16">
        <div className="bg-bubbles overflow-hidden rounded-3xl px-6 py-12 text-center text-brand-ink sm:px-12">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Don&apos;t see what you need?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg font-medium text-brand-ink/80">
            Tell us about the space and what needs doing. If it can be cleaned,
            we will quote it — and if it is outside what we do, we will say so.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/contact?service=general">Request a quote</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-brand-ink/20 bg-white/70"
            >
              <Link href="/public-sector">Government &amp; tenders</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
