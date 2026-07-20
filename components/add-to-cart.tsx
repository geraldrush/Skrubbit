"use client";

import * as React from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { formatZAR } from "@/lib/utils";
import type { Product } from "@/data/products";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddToCart({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem);
  const [sku, setSku] = React.useState(product.variants[0].sku);
  const [qty, setQty] = React.useState(1);

  const variant =
    product.variants.find((v) => v.sku === sku) ?? product.variants[0];

  function add() {
    addItem(
      {
        sku: variant.sku,
        slug: product.slug,
        name: product.name,
        size: variant.size,
        price: variant.price,
        image: product.image,
      },
      qty
    );
    toast.success(`${qty} × ${product.name} (${variant.size}) added to cart`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4">
        <div className="w-40">
          <Label htmlFor="size" className="mb-1.5 block">
            Size
          </Label>
          <Select value={sku} onValueChange={setSku}>
            <SelectTrigger id="size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {product.variants.map((v) => (
                <SelectItem key={v.sku} value={v.sku}>
                  {v.size} — {formatZAR(v.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block">Quantity</Label>
          <div className="flex h-10 items-center rounded-md border">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="px-3 py-2 transition-colors hover:text-accent"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-semibold">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              aria-label="Increase quantity"
              className="px-3 py-2 transition-colors hover:text-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="font-display text-3xl font-extrabold">
          {formatZAR(variant.price * qty)}
        </p>
        <Button size="lg" onClick={add} className="flex-1 sm:flex-none">
          <ShoppingCart className="h-5 w-5" />
          Add to cart
        </Button>
      </div>
    </div>
  );
}
