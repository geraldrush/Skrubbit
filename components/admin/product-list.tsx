"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatZAR } from "@/lib/utils";
import { fromPrice, type Product } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ProductList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<string | null>(null);

  async function remove(product: Product) {
    if (
      !window.confirm(
        `Delete "${product.name}"? This removes it from the shop immediately and cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(product.slug);
    try {
      const res = await fetch(`/api/admin/products/${product.slug}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete");
      toast.success(`${product.name} deleted`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(null);
    }
  }

  if (!products.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No products yet. Add the first one below.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {products.map((p) => (
        <li key={p.slug} className="flex items-center gap-4 p-3">
          <div className="relative h-14 w-14 shrink-0 rounded bg-muted/30">
            {p.image ? (
              <Image src={p.image} alt="" fill className="object-contain p-1" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{p.name}</span>
              {p.featured ? (
                <Badge variant="secondary" className="text-xs">
                  Homepage
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {p.variants.length} size{p.variants.length === 1 ? "" : "s"} · from{" "}
              {formatZAR(fromPrice(p))} · /{p.slug}
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" aria-label={`View ${p.name}`}>
            <Link href={`/shop/${p.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={deleting === p.slug}
            onClick={() => remove(p)}
            aria-label={`Delete ${p.name}`}
          >
            {deleting === p.slug ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}
