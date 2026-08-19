/**
 * Telling somebody a message arrived.
 *
 * Until now an enquiry was written to D1 and nothing else happened: no
 * notification, and no page in /admin that showed it. Meanwhile the site
 * invites a supply chain officer to "send us an RFQ". A quotation request with
 * a closing date sitting unread in a table is a lost contract, so every
 * enquiry now goes out by email the moment it lands.
 *
 * Two messages per enquiry. One to the business, so somebody acts on it. One
 * back to the sender, so they know it arrived — a customer who gets no
 * acknowledgement assumes the form is broken and phones a competitor.
 */

import { getCompanyProfileSafe } from "@/lib/company";
import { emailConfigured, parseRecipients, sendEmail, type EmailEnv } from "@/lib/notify";

const escapeHtml = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nl2br = (v: string) => escapeHtml(v).replace(/\n/g, "<br>");

/**
 * Where business mail goes.
 *
 * The company address first — that is the inbox the website advertises. The
 * notification addresses are added behind it deliberately: mail to info@ only
 * arrives once an Email Routing rule exists for it, and an enquiry must not be
 * lost while that is being set up. Duplicates are removed, so once info@
 * routes to those same inboxes nobody gets two copies.
 */
async function businessRecipients(): Promise<string[]> {
  const profile = await getCompanyProfileSafe();
  const all = [
    ...parseRecipients(profile.email),
    ...parseRecipients(profile.notifyEmail),
  ];
  return [...new Set(all.map((a) => a.toLowerCase()))];
}

export interface OrderLine {
  name: string;
  size: string;
  qty: number;
  price: number;
}

const money = (v: number) => `R${v.toFixed(2)}`;

function linesTable(items: OrderLine[]): { html: string; text: string } {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:4px 10px 4px 0">${i.qty} ×</td>` +
        `<td style="padding:4px 10px 4px 0">${escapeHtml(i.name)} (${escapeHtml(i.size)})</td>` +
        `<td style="padding:4px 0;text-align:right">${money(i.price * i.qty)}</td></tr>`
    )
    .join("");
  return {
    html: `<table style="border-collapse:collapse;font-size:14px">${rows}</table>`,
    text: items
      .map((i) => `${i.qty} x ${i.name} (${i.size})  ${money(i.price * i.qty)}`)
      .join("\n"),
  };
}

export interface OrderNotification {
  reference: string;
  items: OrderLine[];
  subtotal: number;
  customer: { name: string; phone: string; email: string; address: string; note: string };
}

/** Emails an order to the business and a confirmation to the customer. */
export async function notifyOrder(env: EmailEnv, order: OrderNotification): Promise<void> {
  if (!emailConfigured(env)) return;
  const { reference, items, subtotal, customer } = order;
  const table = linesTable(items);
  const to = await businessRecipients();

  const detail =
    `<p><strong>Order ${escapeHtml(reference)}</strong></p>` +
    table.html +
    `<p><strong>Subtotal ${money(subtotal)}</strong> — excludes VAT and delivery.</p>` +
    `<p>${escapeHtml(customer.name)}<br>` +
    `${escapeHtml(customer.phone)}<br>` +
    `${escapeHtml(customer.email)}</p>` +
    (customer.address ? `<p>${nl2br(customer.address)}</p>` : "") +
    (customer.note ? `<p><em>${nl2br(customer.note)}</em></p>` : "");

  if (to.length) {
    await sendEmail(env, {
      to,
      subject: `New order ${reference} — ${customer.name}`,
      html: detail,
      text:
        `Order ${reference}\n\n${table.text}\n\nSubtotal ${money(subtotal)} (excl. VAT and delivery)\n\n` +
        `${customer.name}\n${customer.phone}\n${customer.email}\n${customer.address}\n\n${customer.note}`,
    });
  }

  if (customer.email) {
    await sendEmail(env, {
      to: customer.email,
      subject: `We have your order — ${reference}`,
      html:
        `<p>Thank you, ${escapeHtml(customer.name)}. Your order has reached us and we will be in touch shortly to confirm availability, delivery and the final price.</p>` +
        table.html +
        `<p><strong>Subtotal ${money(subtotal)}</strong><br>` +
        `<span style="color:#666;font-size:13px">Excludes VAT and delivery. This is an order request, not an invoice — nothing is charged until we have confirmed it with you.</span></p>` +
        `<p>Quote reference <strong>${escapeHtml(reference)}</strong> if you contact us.</p>`,
      text:
        `Thank you, ${customer.name}. Your order has reached us and we will be in touch shortly.\n\n` +
        `${table.text}\n\nSubtotal ${money(subtotal)} (excludes VAT and delivery).\n` +
        `This is an order request, not an invoice.\n\nReference ${reference}`,
    });
  }
}

/** Emails a contact-form enquiry to the business and acknowledges the sender. */
export async function notifyEnquiry(
  env: EmailEnv,
  enquiry: { name: string; email: string; phone: string; message: string }
): Promise<void> {
  if (!emailConfigured(env)) return;
  const to = await businessRecipients();

  if (to.length) {
    await sendEmail(env, {
      to,
      subject: `Website enquiry — ${enquiry.name}`,
      html:
        `<p><strong>${escapeHtml(enquiry.name)}</strong><br>` +
        `${escapeHtml(enquiry.email)}${enquiry.phone ? `<br>${escapeHtml(enquiry.phone)}` : ""}</p>` +
        `<p>${nl2br(enquiry.message)}</p>`,
      text: `${enquiry.name}\n${enquiry.email}\n${enquiry.phone}\n\n${enquiry.message}`,
    });
  }

  await sendEmail(env, {
    to: enquiry.email,
    subject: "We have your message",
    html:
      `<p>Thank you, ${escapeHtml(enquiry.name)}. Your message has reached us and we will reply shortly.</p>` +
      `<p style="color:#666;font-size:13px">For reference, this is what you sent:</p>` +
      `<blockquote style="border-left:3px solid #FFCC00;margin:0;padding-left:12px;color:#444">${nl2br(enquiry.message)}</blockquote>`,
    text: `Thank you, ${enquiry.name}. Your message has reached us and we will reply shortly.\n\nWhat you sent:\n${enquiry.message}`,
  });
}
