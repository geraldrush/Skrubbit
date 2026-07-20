import { site } from "@/data/site";
import { formatZAR } from "@/lib/utils";
import type { CartItem } from "@/store/cart";

export interface EnquiryDetails {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
}

/** Build the plain-text order message shared to WhatsApp / email. */
export function buildOrderMessage(
  items: CartItem[],
  subtotal: number,
  details: EnquiryDetails
): string {
  const lines: string[] = [];
  lines.push("*New Skrubb-it order enquiry*");
  lines.push("");
  items.forEach((i) => {
    lines.push(
      `• ${i.qty} × ${i.name} (${i.size}) — ${formatZAR(i.price * i.qty)}`
    );
  });
  lines.push("");
  lines.push(`*Subtotal:* ${formatZAR(subtotal)} (excl. delivery)`);
  lines.push("");
  lines.push("*Customer details*");
  lines.push(`Name: ${details.name}`);
  lines.push(`Phone: ${details.phone}`);
  if (details.email) lines.push(`Email: ${details.email}`);
  if (details.address) lines.push(`Delivery address: ${details.address}`);
  if (details.note) lines.push(`Note: ${details.note}`);
  return lines.join("\n");
}

/** wa.me deep link that opens WhatsApp with the order pre-filled. */
export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent(
    message
  )}`;
}

/** mailto: link as a fallback / secondary channel. */
export function buildMailtoLink(subject: string, body: string): string {
  return `mailto:${site.contact.email}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
