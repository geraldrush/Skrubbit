"use client";

import * as React from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { buildWhatsAppLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * One enquiry, two channels.
 *
 * The details are recorded and emailed first, then WhatsApp opens with the
 * message ready to send. Either half is enough on its own: a customer whose
 * WhatsApp never opens has still reached us, and one who prefers to chat is
 * not made to wait for an email reply.
 *
 * The order matters. WhatsApp is opened only after the record succeeds,
 * because a popup blocker eating the hand-off used to lose the enquiry
 * entirely.
 */
export function EnquiryForm({
  title = "Send us an enquiry",
  intro = "Tell us what you need and we will reply within one business day.",
  className = "",
}: {
  title?: string;
  intro?: string;
  className?: string;
}) {
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in your name, email and message.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not send your message");

      setSent(true);
      window.open(
        buildWhatsAppLink(
          `Hi Skrubb-it, my name is ${form.name}.\n\n${form.message}\n\nYou can reach me on ${form.email}${
            form.phone ? ` or ${form.phone}` : ""
          }.`
        ),
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send your message"
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className={`rounded-2xl border bg-background p-6 sm:p-8 ${className}`}>
        <h2 className="font-display text-2xl font-extrabold">
          Thank you, {form.name.split(" ")[0]}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Your message has reached Skrubb-it and you will be contacted shortly.
          A confirmation is on its way to {form.email}.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => {
            setSent(false);
            setForm({ name: "", email: "", phone: "", message: "" });
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  const labelClass =
    "text-xs font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <form
      onSubmit={submit}
      className={`rounded-2xl border bg-background p-6 sm:p-8 ${className}`}
    >
      <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      <p className="mt-1 text-muted-foreground">{intro}</p>

      <div className="mt-6 space-y-5 border-t pt-6">
        <div className="space-y-2">
          <Label htmlFor="eq-name" className={labelClass}>
            Your name
          </Label>
          <Input
            id="eq-name"
            value={form.name}
            onChange={set("name")}
            placeholder="Full name"
            autoComplete="name"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eq-email" className={labelClass}>
              Email address
            </Label>
            <Input
              id="eq-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@company.co.za"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eq-phone" className={labelClass}>
              Phone <span className="font-normal normal-case">(optional)</span>
            </Label>
            <Input
              id="eq-phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="081 234 5678"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="eq-message" className={labelClass}>
            How can we help?
          </Label>
          <Textarea
            id="eq-message"
            value={form.message}
            onChange={set("message")}
            rows={5}
            placeholder="What you need, how much of it, and where it must be delivered."
          />
        </div>

        <Button
          type="submit"
          size="lg"
          variant="accent"
          disabled={busy}
          className="w-full"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MessageCircle className="h-5 w-5" />
          )}
          Send enquiry
        </Button>

        <p className="text-sm text-muted-foreground">
          Sending opens WhatsApp with your message ready to go. Your details
          reach us either way.
        </p>
      </div>
    </form>
  );
}
