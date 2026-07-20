import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { site } from "@/data/site";
import { ContactForm } from "@/components/contact-form";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Skrubb-it for orders, bulk pricing and stockist enquiries. Message us on WhatsApp or send us an email.",
};

const faqs = [
  {
    q: "Do you offer bulk and wholesale pricing?",
    a: "Yes. We supply households, businesses, guest houses, schools and resellers. Send us your list on WhatsApp or the contact form and we'll quote you.",
  },
  {
    q: "How does ordering work?",
    a: "Add products to your cart and check out — we'll open WhatsApp with your order pre-filled. We then confirm stock, delivery and payment with you directly.",
  },
  {
    q: "Do you deliver?",
    a: "Delivery is quoted based on your location and order size. We'll confirm the delivery fee (or collection details) when we process your order.",
  },
  {
    q: "Where else can I buy Skrubb-it?",
    a: "You can also find selected Skrubb-it products on Takealot.",
  },
];

export default function ContactPage() {
  return (
    <div className="container py-10">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold">Get in touch</h1>
        <p className="mt-2 text-muted-foreground">
          Questions, bulk orders or stockist enquiries — we&apos;d love to hear
          from you. The fastest way to reach us is WhatsApp.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <ContactForm />
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border bg-secondary/40 p-6">
            <h2 className="font-display text-lg font-bold">Contact details</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span>{site.contact.location}</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span>{site.contact.phoneDisplay}</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <a
                  href={`mailto:${site.contact.email}`}
                  className="hover:text-accent"
                >
                  {site.contact.email}
                </a>
              </li>
            </ul>
            <Button asChild variant="accent" className="mt-5 w-full">
              <a
                href={`https://wa.me/${site.contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-5 w-5" />
                Chat on WhatsApp
              </a>
            </Button>
          </div>
        </aside>
      </div>

      {/* FAQ */}
      <section className="mt-16 max-w-3xl">
        <h2 className="mb-4 font-display text-2xl font-extrabold">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible>
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
