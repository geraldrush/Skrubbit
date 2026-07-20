"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { categories, type CategoryId, type Product } from "@/data/products";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";

// Products are passed in from the server page rather than imported: the
// catalogue now lives in D1, which a client component can't read.
export function ShopGrid({ products }: { products: Product[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") as CategoryId | null;
  const [query, setQuery] = React.useState("");

  function selectCategory(id: CategoryId | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("category", id);
    else params.delete("category");
    const qs = params.toString();
    router.replace(qs ? `/shop?${qs}` : "/shop", { scroll: false });
  }

  const filtered = products.filter((p) => {
    const matchesCategory = !activeCategory || p.category === activeCategory;
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.tagline.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div>
      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        <FilterChip
          active={!activeCategory}
          onClick={() => selectCategory(null)}
        >
          All products
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            active={activeCategory === c.id}
            onClick={() => selectCategory(c.id)}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          No products match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background hover:border-accent hover:text-accent"
      )}
    >
      {children}
    </button>
  );
}
