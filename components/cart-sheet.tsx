"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { formatZAR } from "@/lib/utils";
import { site } from "@/data/site";
import { useCart, cartSubtotal, cartCount } from "@/store/cart";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export function CartSheet() {
  const { items, isOpen, setOpen, setQty, removeItem } = useCart();
  const subtotal = cartSubtotal(items);
  const count = cartCount(items);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-accent" />
            Your cart {count > 0 && `(${count})`}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="rounded-full bg-secondary p-5">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Your cart is empty.</p>
            <SheetClose asChild>
              <Button asChild variant="default">
                <Link href="/shop">Browse products</Link>
              </Button>
            </SheetClose>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.sku} className="flex gap-3 py-4">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-white">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-contain p-1"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.size}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.sku)}
                          aria-label={`Remove ${item.name}`}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-md border">
                          <button
                            onClick={() => setQty(item.sku, item.qty - 1)}
                            aria-label="Decrease quantity"
                            className="p-1.5 transition-colors hover:text-accent"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => setQty(item.sku, item.qty + 1)}
                            aria-label="Increase quantity"
                            className="p-1.5 transition-colors hover:text-accent"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-bold">
                          {formatZAR(item.price * item.qty)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <SheetFooter>
              <div className="flex items-center justify-between text-base">
                <span className="font-semibold">Subtotal</span>
                <span className="font-display text-xl font-bold">
                  {formatZAR(subtotal)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Delivery is quoted separately.
                {site.freeDeliveryOver > 0 &&
                  subtotal < site.freeDeliveryOver &&
                  ` Add ${formatZAR(
                    site.freeDeliveryOver - subtotal
                  )} more for free delivery.`}
              </p>
              <Separator className="my-1" />
              <SheetClose asChild>
                <Button asChild size="lg" variant="accent" className="w-full">
                  <Link href="/checkout">Checkout via WhatsApp</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button variant="ghost" className="w-full">
                  Continue shopping
                </Button>
              </SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
