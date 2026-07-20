import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Sparkles, HeartHandshake, Recycle } from "lucide-react";

import { site } from "@/data/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Skrubb-it is a proudly South African, black woman–owned manufacturer of industrial and household cleaning products and personal care essentials.",
};

const values = [
  {
    icon: Sparkles,
    title: "Quality first",
    body: "Professional-strength formulas that deliver real cleaning power, batch after batch.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted & safe",
    body: "Products made to consistent standards you and your family can rely on.",
  },
  {
    icon: HeartHandshake,
    title: "Empowerment",
    body: "A black woman–owned business creating opportunity in our community.",
  },
  {
    icon: Recycle,
    title: "Value for money",
    body: "Concentrated formulas and bulk sizes that stretch your budget further.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Intro */}
      <section className="bg-bubbles">
        <div className="container py-14 text-brand-ink md:py-20">
          <Badge className="bg-accent text-accent-foreground">Our story</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-extrabold sm:text-5xl">
            Cleaning products made with pride, in South Africa.
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium text-brand-ink/80">
            {site.legalName} manufactures a full range of industrial and
            household cleaning products and personal care essentials — trusted
            by families and businesses across the country.
          </p>
        </div>
      </section>

      {/* Body copy */}
      <section className="container grid gap-10 py-14 md:grid-cols-2">
        <div className="space-y-4 text-foreground/90">
          <h2 className="font-display text-2xl font-extrabold">Who we are</h2>
          <p>
            Skrubb-it started with a simple goal: to make powerful, dependable
            cleaning products accessible and affordable for every South African
            home and business. From dishwashing liquid and pine gel to bleach,
            toilet cleaner and fabric softener, our range covers the everyday
            essentials — in sizes from handy 750&nbsp;ml bottles to 25&nbsp;L
            bulk drums.
          </p>
          <p>
            We&apos;re a proudly black woman–owned enterprise, and we believe
            business should uplift the people around it. Every bottle we make is
            a step towards creating jobs, opportunity and pride in locally-made
            quality.
          </p>
        </div>
        <div className="space-y-4 text-foreground/90">
          <h2 className="font-display text-2xl font-extrabold">
            Why customers choose us
          </h2>
          <p>
            Our formulas are concentrated and professional-strength, so a little
            goes a long way. That means better results and better value — the
            reason households, guest houses, schools and offices keep coming
            back.
          </p>
          <p>
            You&apos;ll also find Skrubb-it on{" "}
            <a
              href={site.socials.takealot}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              Takealot
            </a>
            , or you can order directly from us here on the site — quick and
            easy over WhatsApp.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="bg-secondary/40 py-14">
        <div className="container">
          <h2 className="mb-8 text-center font-display text-3xl font-extrabold">
            What we stand for
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border bg-card p-6 text-center"
              >
                <div className="mx-auto mb-3 w-fit rounded-xl bg-primary/20 p-3 text-brand-ink">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-bold">{v.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 text-center">
        <h2 className="font-display text-3xl font-extrabold">
          Ready to stock up?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Explore the full range or get in touch for bulk and wholesale pricing.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" variant="accent">
            <Link href="/shop">Shop products</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
