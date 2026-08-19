import type { Metadata } from "next";
import { Mail, Phone } from "lucide-react";

import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { getRecentContactMessages, getRecentOrders } from "@/lib/enquiries";
import { formatZAR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enquiries",
  robots: { index: false, follow: false },
};

/**
 * Everything customers have sent.
 *
 * These were being written to D1 and never shown anywhere — the dashboard
 * displayed a count and nothing else, so an RFQ with a closing date could sit
 * unread indefinitely. Enquiries are emailed now as well, but the record has
 * to be readable in one place too.
 */
export default async function EnquiriesPage() {
  const gate = await adminGate();
  if (gate) return gate;

  const [messages, orders] = await Promise.all([
    getRecentContactMessages(50),
    getRecentOrders(50),
  ]);

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/enquiries"
        title="Enquiries"
        description="Messages from the contact form and orders placed through the shop. Both are emailed to you as they arrive; this is the record."
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">
          Orders <span className="text-muted-foreground">({orders.length})</span>
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {orders.map((o) => (
              <li key={o.reference} className="space-y-1 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {o.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {o.reference}
                    </span>
                  </p>
                  <p className="font-semibold">{formatZAR(o.subtotal)}</p>
                </div>
                <p className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {o.email && (
                    <a href={`mailto:${o.email}`} className="hover:text-accent">
                      <Mail className="mr-1 inline h-3.5 w-3.5" />
                      {o.email}
                    </a>
                  )}
                  {o.phone && (
                    <a href={`tel:${o.phone}`} className="hover:text-accent">
                      <Phone className="mr-1 inline h-3.5 w-3.5" />
                      {o.phone}
                    </a>
                  )}
                  <span>{o.createdAt.slice(0, 16)}</span>
                </p>
                <ul className="text-sm text-muted-foreground">
                  {o.items.map((i, n) => (
                    <li key={n}>
                      {i.qty} × {i.name} ({i.size})
                    </li>
                  ))}
                </ul>
                {o.address && (
                  <p className="text-sm text-muted-foreground">{o.address}</p>
                )}
                {o.note && <p className="text-sm italic text-muted-foreground">{o.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-lg font-bold">
          Messages{" "}
          <span className="text-muted-foreground">({messages.length})</span>
        </h2>
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {messages.map((m) => (
              <li key={m.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.createdAt.slice(0, 16)}
                  </p>
                </div>
                <p className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <a href={`mailto:${m.email}`} className="hover:text-accent">
                    <Mail className="mr-1 inline h-3.5 w-3.5" />
                    {m.email}
                  </a>
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="hover:text-accent">
                      <Phone className="mr-1 inline h-3.5 w-3.5" />
                      {m.phone}
                    </a>
                  )}
                </p>
                <p className="whitespace-pre-wrap text-sm">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
