import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Check, ChevronRight, Leaf } from "lucide-react";

import { getCategory } from "@/data/products";
import { getProduct, getProducts } from "@/lib/products";
import { AddToCart } from "@/components/add-to-cart";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Slugs are no longer known at build time now that products live in D1, so
// generateStaticParams is gone and pages render per-request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description,
    openGraph: { images: [product.image] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const category = getCategory(product.category);
  const related = (await getProducts())
    .filter((p) => p.category === product.category && p.slug !== product.slug)
    .slice(0, 4);

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/shop" className="hover:text-accent">
          Shop
        </Link>
        <ChevronRight className="h-4 w-4" />
        {category && (
          <>
            <Link
              href={`/shop?category=${category.id}`}
              className="hover:text-accent"
            >
              {category.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="font-medium text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-2xl border bg-white">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 500px"
            className="object-contain p-8"
          />
          {product.featured && (
            <Badge variant="accent" className="absolute left-4 top-4">
              Bestseller
            </Badge>
          )}
        </div>

        {/* Details */}
        <div>
          {category && (
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              {category.name}
            </p>
          )}
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {product.tagline}
          </p>

          <Separator className="my-6" />

          <AddToCart product={product} />

          <Separator className="my-6" />

          <p className="leading-relaxed text-foreground/90">
            {product.description}
          </p>

          {product.scents && product.scents.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Leaf className="h-4 w-4 text-accent" />
                Available fragrances
              </p>
              <div className="flex flex-wrap gap-2">
                {product.scents.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Tell us your preferred fragrance when you place your order.
              </p>
            </div>
          )}

          {product.usage && product.usage.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 font-display text-lg font-bold">How to use</h2>
              <ul className="space-y-2">
                {product.usage.map((u) => (
                  <li key={u} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-foreground/90">{u}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-extrabold">
            You might also like
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
