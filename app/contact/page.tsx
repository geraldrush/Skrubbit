import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { site } from "@/data/site";
import { getService } from "@/data/services";
import { EnquiryForm } from "@/components/enquiry-form";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Contact & Quotes — Cleaning Products and Services",
  alternates: { canonical: "/contact" },
  description:
    "Contact Skrubb-it for cleaning product orders, bulk pricing and cleaning service quotes in Limpopo. WhatsApp, phone or email.",
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
    q: "Do you offer cleaning services as well as products?",
    a: "Yes. We do deep, heavy-duty, industrial, office and specialist cleaning, once-off or on contract, using our own products. See the services page for the full list, or tell us about the job and we'll quote it.",
  },
  {
    q: "Where else can I buy Skrubb-it?",
    a: "You can also find selected Skrubb-it products on Takealot.",
  },
];

/**
 * /contact?service=<slug> arrives from the services page with the service
 * already named in the message; "general" is a cleaning enquiry with no
 * particular service picked. Anything else is ignored rather than echoed into
 * the form.
 */
function serviceMessage(slug: string | undefined): string {
  if (!slug) return "";
  if (slug === "general") {
    return "I'd like a quote for cleaning services.\n\nPremises / location:\nWhat needs cleaning:\nOnce-off or regular:";
  }
  const service = getService(slug);
  if (!service) return "";
  return `I'd like a quote for ${service.name.toLowerCase()}.\n\nPremises / location:\nSize or number of rooms:\nPreferred date:`;
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const { service } = await searchParams;
  const initialMessage = serviceMessage(
    Array.isArray(service) ? service[0] : service
  );

  return (
    <div className="container py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold">Get in touch</h1>
        <p className="mt-2 text-muted-foreground">
          Questions, bulk orders, cleaning services or stockist enquiries — we&apos;d love to hear
          from you. The fastest way to reach us is WhatsApp.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <EnquiryForm initialMessage={initialMessage} />
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
