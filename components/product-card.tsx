"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { formatZAR } from "@/lib/utils";
import { fromPrice, type Product } from "@/data/products";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem);
  const cheapest = product.variants.reduce((a, b) =>
    a.price <= b.price ? a : b
  );

  function quickAdd() {
    addItem({
      sku: cheapest.sku,
      slug: product.slug,
      name: product.name,
      size: cheapest.size,
      price: cheapest.price,
      image: product.image,
    });
    toast.success(`${product.name} (${cheapest.size}) added to cart`);
  }

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link
        href={`/shop/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-white"
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
        {product.featured && (
          <Badge variant="accent" className="absolute left-3 top-3">
            Bestseller
          </Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/shop/${product.slug}`}>
          <h3 className="font-display text-lg font-bold leading-tight">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {product.tagline}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground">from</span>
            <p className="font-display text-lg font-bold text-accent">
              {formatZAR(fromPrice(product))}
            </p>
          </div>
          <Button size="icon" onClick={quickAdd} aria-label={`Add ${product.name} to cart`}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
