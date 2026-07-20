import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Sparkles,
  Truck,
  HeartHandshake,
  ArrowRight,
} from "lucide-react";

import { site } from "@/data/site";
import { categories } from "@/data/products";
import { getProducts } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/product-card";

const perks = [
  {
    icon: Sparkles,
    title: "Powerful & concentrated",
    body: "Professional-strength formulas — a little goes a long way.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted quality",
    body: "5-star rated and loved by South African households.",
  },
  {
    icon: Truck,
    title: "Bulk & retail sizes",
    body: "From 750 ml bottles to 25 L drums for every need.",
  },
  {
    icon: HeartHandshake,
    title: "Proudly local",
    body: "Black woman–owned, manufactured in South Africa.",
  },
];

// Featured products come from D1.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = (await getProducts()).filter((p) => p.featured);

  return (
    <>
      {/* Hero */}
      <section className="bg-bubbles">
        <div className="container grid items-center gap-8 py-14 md:grid-cols-2 md:py-20">
          <div className="space-y-6 text-brand-ink">
            <Badge className="bg-accent text-accent-foreground">
              ★★★★★ Loved by South Africans
            </Badge>
            <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Powerful cleaning,{" "}
              <span className="text-accent">proudly&nbsp;local.</span>
            </h1>
            <p className="max-w-md text-lg font-medium text-brand-ink/80">
              {site.legalName} manufactures industrial &amp; household cleaning
              products and personal care essentials — quality you can trust, at
              prices that make sense.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link href="/shop">
                  Shop products
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-brand-ink/20 bg-white/70"
              >
                <Link href="/about">Our story</Link>
              </Button>
            </div>
          </div>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl">
            <div className="absolute inset-0 rounded-full bg-white/40 blur-2xl" />
            <Image
              src="/images/brand/hero.webp"
              alt="The Skrubb-it range of cleaning products"
              fill
              priority
              sizes="(max-width: 768px) 90vw, 672px"
              className="relative object-contain drop-shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="border-y bg-secondary/40">
        <div className="container grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk) => (
            <div key={perk.title} className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/20 p-2.5 text-brand-ink">
                <perk.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold">
                  {perk.title}
                </h3>
                <p className="text-sm text-muted-foreground">{perk.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-extrabold">
              Shop by category
            </h2>
            <p className="mt-1 text-muted-foreground">
              Everything you need for a spotless home or workplace.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/shop?category=${c.id}`}
              className="group rounded-xl border bg-card p-4 text-center transition-colors hover:border-accent hover:bg-secondary"
            >
              <p className="font-display text-sm font-bold leading-tight">
                {c.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{c.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-secondary/40 py-14">
        <div className="container">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl font-extrabold">
                Bestsellers
              </h2>
              <p className="mt-1 text-muted-foreground">
                Our most popular formulas.
              </p>
            </div>
            <Button asChild variant="link" className="hidden sm:inline-flex">
              <Link href="/shop">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Button asChild variant="outline">
              <Link href="/shop">View all products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16">
        <div className="bg-bubbles overflow-hidden rounded-3xl px-6 py-12 text-center text-brand-ink sm:px-12">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Need bulk cleaning supplies?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg font-medium text-brand-ink/80">
            We supply schools, offices, guest houses and businesses across South
            Africa. Get a quote on WhatsApp in minutes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/contact">Request a quote</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-brand-ink/20 bg-white/70"
            >
              <Link href="/shop">Browse the shop</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
