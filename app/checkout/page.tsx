"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Mail, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { formatZAR } from "@/lib/utils";
import { site } from "@/data/site";
import { useCart, cartSubtotal } from "@/store/cart";
import {
  buildOrderMessage,
  buildWhatsAppLink,
  buildMailtoLink,
} from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCart();
  const subtotal = cartSubtotal(items);
  const [mounted, setMounted] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    note: "",
  });
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error("Please enter your name and phone number.");
      return;
    }
    setSubmitting(true);
    const message = buildOrderMessage(items, subtotal, form);

    // Record the enquiry server-side (best-effort — never blocks the order).
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, subtotal, customer: form }),
      });
    } catch {
      /* ignore — WhatsApp is the primary channel */
    }

    const link = buildWhatsAppLink(message);
    window.open(link, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp with your order…");
    setSubmitting(false);
  }

  if (mounted && items.length === 0) {
    return (
      <div className="container flex flex-col items-center gap-4 py-24 text-center">
        <div className="rounded-full bg-secondary p-6">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
        <p className="text-muted-foreground">
          Add some products before checking out.
        </p>
        <Button asChild>
          <Link href="/shop">Browse products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="font-display text-3xl font-extrabold">Checkout</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Fill in your details and we&apos;ll open WhatsApp with your order ready
        to send. We&apos;ll confirm stock, delivery and payment with you
        directly — no card details needed here.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name *</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={update("name")}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone / WhatsApp *</Label>
              <Input
                id="phone"
                required
                inputMode="tel"
                value={form.phone}
                onChange={update("phone")}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={update("email")}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="address">Delivery address</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={update("address")}
              className="mt-1.5"
              placeholder="Street, suburb, city, postal code"
            />
          </div>
          <div>
            <Label htmlFor="note">Order notes</Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={update("note")}
              className="mt-1.5"
              placeholder="Preferred fragrances, delivery date, anything else…"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              size="lg"
              variant="accent"
              disabled={submitting}
              className="flex-1"
            >
              <MessageCircle className="h-5 w-5" />
              Send order on WhatsApp
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() =>
                (window.location.href = buildMailtoLink(
                  "Skrubb-it order enquiry",
                  buildOrderMessage(items, subtotal, form)
                ))
              }
            >
              <Mail className="h-5 w-5" />
              Email instead
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            By sending, WhatsApp opens with your order pre-filled to{" "}
            {site.contact.phoneDisplay}. You can review before sending.
          </p>
        </form>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 flex items-center justify-between font-display text-lg font-bold">
                Order summary
                {mounted && (
                  <button
                    type="button"
                    onClick={() => {
                      clear();
                      router.push("/shop");
                    }}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive"
                  >
                    Clear
                  </button>
                )}
              </h2>
              <ul className="space-y-3">
                {mounted &&
                  items.map((item) => (
                    <li key={item.sku} className="flex gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border bg-white">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-contain p-0.5"
                        />
                      </div>
                      <div className="flex flex-1 justify-between gap-2 text-sm">
                        <span>
                          {item.qty} × {item.name}
                          <span className="block text-xs text-muted-foreground">
                            {item.size}
                          </span>
                        </span>
                        <span className="font-semibold">
                          {formatZAR(item.price * item.qty)}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Subtotal</span>
                <span className="font-display text-xl font-bold">
                  {mounted ? formatZAR(subtotal) : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Delivery quoted separately based on your location.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
