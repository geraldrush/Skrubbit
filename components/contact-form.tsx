"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      setSent(true);
      form.reset();
      toast.success("Thanks! We'll be in touch soon.");
    } catch {
      toast.error("Something went wrong. Please WhatsApp us instead.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border bg-secondary/50 p-8 text-center">
        <h3 className="font-display text-xl font-bold">Message sent ✅</h3>
        <p className="mt-2 text-muted-foreground">
          Thank you for reaching out. Our team will get back to you shortly.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" name="name" required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="c-phone">Phone</Label>
          <Input id="c-phone" name="phone" inputMode="tel" className="mt-1.5" />
        </div>
      </div>
      <div>
        <Label htmlFor="c-email">Email *</Label>
        <Input
          id="c-email"
          name="email"
          type="email"
          required
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="c-message">Message *</Label>
        <Textarea
          id="c-message"
          name="message"
          required
          className="mt-1.5 min-h-32"
          placeholder="How can we help? Bulk orders, stockist enquiries, product questions…"
        />
      </div>
      <Button type="submit" size="lg" disabled={submitting}>
        <Send className="h-4 w-4" />
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
