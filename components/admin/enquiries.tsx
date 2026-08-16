import { Mail, MessageSquare, Phone, ShoppingBag } from "lucide-react";

import { formatZAR } from "@/lib/utils";
import type { ContactRecord, OrderRecord } from "@/lib/enquiries";

/**
 * Read-only view of stored orders and contact messages.
 *
 * Persisting these to D1 is only half a fix — without somewhere to read them
 * the shop owner would still have to run SQL by hand to find out that anyone
 * had been in touch. Deliberately read-only: nothing here mutates, so there is
 * no new write surface to protect.
 */

/**
 * D1 stores `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC. That string
 * without a zone is parsed inconsistently across engines, so it is pinned to
 * UTC explicitly and then shifted to SAST — a fixed UTC+2 with no daylight
 * saving, which is why the offset can be hardcoded.
 */
function formatSast(raw: string): string {
  const utc = new Date(`${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(utc.getTime())) return raw;
  const sast = new Date(utc.getTime() + 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${sast.getUTCFullYear()}-${pad(sast.getUTCMonth() + 1)}-${pad(sast.getUTCDate())}` +
    ` ${pad(sast.getUTCHours())}:${pad(sast.getUTCMinutes())}`
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      {children}
    </p>
  );
}

function ContactLinks({ email, phone }: { email?: string; phone?: string }) {
  if (!email && !phone) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {phone ? (
        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-accent">
          <Phone className="h-3.5 w-3.5" />
          {phone}
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-accent">
          <Mail className="h-3.5 w-3.5" />
          {email}
        </a>
      ) : null}
    </div>
  );
}

export function OrderList({ orders }: { orders: OrderRecord[] }) {
  if (!orders.length) {
    return (
      <Empty>
        No orders yet. Every checkout is recorded here, including the ones where
        the customer never sends the WhatsApp message.
      </Empty>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {orders.map((o) => (
        <li key={o.reference} className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-semibold">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              {o.name}
            </span>
            <span className="font-display text-lg font-bold">
              {formatZAR(o.subtotal)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {o.reference} · {formatSast(o.createdAt)}
          </p>

          <ContactLinks email={o.email} phone={o.phone} />

          <ul className="mt-3 space-y-0.5 text-sm text-muted-foreground">
            {o.items.map((item, i) => (
              <li key={i}>
                {item.qty} × {item.name} ({item.size}) —{" "}
                {formatZAR(item.price * item.qty)}
              </li>
            ))}
          </ul>

          {o.address ? (
            <p className="mt-2 whitespace-pre-line text-sm">
              <span className="font-medium">Deliver to: </span>
              {o.address}
            </p>
          ) : null}
          {o.note ? (
            <p className="mt-1 whitespace-pre-line text-sm">
              <span className="font-medium">Note: </span>
              {o.note}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MessageList({ messages }: { messages: ContactRecord[] }) {
  if (!messages.length) {
    return <Empty>No messages from the contact form yet.</Empty>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {messages.map((m) => (
        <li key={m.id} className="p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-semibold">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {m.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatSast(m.createdAt)}
            </span>
          </div>
          <ContactLinks email={m.email} phone={m.phone} />
          <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
        </li>
      ))}
    </ul>
  );
}
