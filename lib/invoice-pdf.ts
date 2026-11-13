/**
 * An invoice or quotation as a PDF, on the same letterhead as the profile.
 *
 * Built per request from the stored record rather than kept as a file: an
 * issued invoice never changes, so regenerating it costs nothing and there is
 * no second copy to fall out of step — except for the "paid" figures, which
 * should be current whenever it is downloaded again.
 *
 * Headed TAX INVOICE only when VAT was charged. A business that is not
 * VAT-registered may not issue a tax invoice at all.
 */

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

import type { CompanyProfile } from "@/lib/company";
import { balance, METHOD_LABELS, type InvoiceDetail } from "@/lib/invoices";
import {
  A4,
  CONTENT_W,
  INK,
  Layout,
  MARGIN,
  MUTED,
  RULE,
  sanitize,
  type Fonts,
} from "@/lib/pdf-layout";
import { letterhead } from "@/lib/profile-pdf";

/** "R 5 210,43" from Intl uses a comma; printed invoices here use a point. */
function rand(amount: number): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split(".");
  return `${amount < 0 ? "-" : ""}R ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${cents}`;
}

function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

const live = (L: Layout) => L.pages[L.pages.length - 1];

/** Label / value pairs right-aligned against the margin, for the totals. */
function rightPairs(L: Layout, fonts: Fonts, rows: [string, string, boolean?][]): void {
  const size = 10;
  const valueRight = MARGIN + CONTENT_W;
  const labelRight = valueRight - 110;
  for (const [label, value, bold] of rows) {
    L.space(0);
    const page = live(L);
    const y = L.cursor - size;
    const font = bold ? fonts.bold : fonts.regular;
    const l = sanitize(label);
    const v = sanitize(value);
    page.drawText(l, {
      x: labelRight - font.widthOfTextAtSize(l, size),
      y,
      size,
      font,
      color: bold ? INK : MUTED,
    });
    page.drawText(v, {
      x: valueRight - font.widthOfTextAtSize(v, size),
      y,
      size,
      font,
      color: INK,
    });
    L.space(size + 6);
  }
}

export async function buildInvoicePdf(data: {
  profile: CompanyProfile;
  invoice: InvoiceDetail;
  logo?: Uint8Array;
}): Promise<Uint8Array> {
  const { profile, invoice: inv, logo } = data;
  const isQuote = inv.kind === "quote";
  const taxInvoice = !isQuote && inv.vatRate > 0;
  const title = isQuote ? "QUOTATION" : taxInvoice ? "TAX INVOICE" : "INVOICE";
  const number = inv.number ?? "DRAFT";

  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  doc.setTitle(`${profile.legalName} — ${title} ${number}`);
  doc.setAuthor(profile.legalName);

  const L = new Layout(doc, fonts);
  await letterhead(doc, L, fonts, profile, logo);

  /* -------------------------- title and particulars ----------------------- */

  const top = L.cursor;
  const page = live(L);
  page.drawText(title, { x: MARGIN, y: top - 20, size: 20, font: fonts.bold, color: INK });

  const meta: [string, string][] = [
    [isQuote ? "Quote no." : "Invoice no.", number],
    ["Date", inv.issuedOn ?? ""],
    [isQuote ? "Valid until" : "Due date", inv.dueOn ?? ""],
    ...(inv.reference ? ([["Your reference", inv.reference]] as [string, string][]) : []),
    ...(taxInvoice && profile.vatNumber
      ? ([["Our VAT no.", profile.vatNumber]] as [string, string][])
      : []),
  ];
  let my = top - 6;
  for (const [label, value] of meta) {
    const v = sanitize(value);
    page.drawText(sanitize(label), {
      x: MARGIN + CONTENT_W - 190,
      y: my - 9,
      size: 9,
      font: fonts.regular,
      color: MUTED,
    });
    page.drawText(v, {
      x: MARGIN + CONTENT_W - fonts.bold.widthOfTextAtSize(v, 9),
      y: my - 9,
      size: 9,
      font: fonts.bold,
      color: INK,
    });
    my -= 14;
  }

  L.space(34);
  L.text(isQuote ? "PREPARED FOR" : "BILL TO", {
    size: 8,
    bold: true,
    color: MUTED,
    width: CONTENT_W - 220,
  });
  L.text(inv.customerName, { bold: true, width: CONTENT_W - 220 });
  if (inv.customerContact) L.text(`Attn: ${inv.customerContact}`, { width: CONTENT_W - 220 });
  if (inv.customerAddress) L.text(inv.customerAddress, { color: MUTED, width: CONTENT_W - 220 });
  if (inv.customerVat)
    L.text(`VAT no. ${inv.customerVat}`, { color: MUTED, width: CONTENT_W - 220 });

  // Whichever ran lower: the bill-to block or the particulars.
  L.space(Math.max(0, L.cursor - my) + 14);

  /* --------------------------------- lines -------------------------------- */

  L.table({
    head: ["Description", "Qty", "Unit", "Unit price", "Amount"],
    widths: [0.46, 0.09, 0.12, 0.15, 0.18],
    align: ["left", "right", "left", "right", "right"],
    rows: inv.lines.map((l) => [
      l.description,
      qty(l.quantity),
      l.unit,
      rand(l.unitPrice),
      rand(l.quantity * l.unitPrice),
    ]),
  });

  const pairs: [string, string, boolean?][] = [];
  if (taxInvoice) {
    pairs.push(["Subtotal (excl. VAT)", rand(inv.subtotal)]);
    pairs.push([`VAT ${Math.round(inv.vatRate * 100)}%`, rand(inv.vat)]);
  }
  pairs.push(["Total", rand(inv.total), true]);
  if (!isQuote && inv.paid > 0) {
    pairs.push(["Paid", rand(-inv.paid)]);
    pairs.push(["Balance due", rand(balance(inv)), true]);
  }
  rightPairs(L, fonts, pairs);

  if (!taxInvoice && !isQuote) {
    L.space(4);
    L.text(
      `${profile.legalName || "The supplier"} is not registered for VAT. No VAT has been charged.`,
      {
        size: 8,
        color: MUTED,
      }
    );
  }

  /* ------------------------------ how to pay ------------------------------ */

  if (!isQuote && inv.payments.length) {
    L.space(10);
    L.text("PAYMENTS RECEIVED", { size: 8, bold: true, color: MUTED });
    for (const p of inv.payments) {
      L.text(
        `${p.receivedOn}  ·  ${METHOD_LABELS[p.method]}  ·  ${rand(p.amount)}${p.reference ? `  ·  ${p.reference}` : ""}`,
        {
          size: 9,
        }
      );
    }
  }

  if (!isQuote && profile.bankDetails) {
    L.space(12);
    L.rule();
    L.text("BANKING DETAILS", { size: 8, bold: true, color: MUTED });
    L.text(profile.bankDetails, { size: 9 });
    L.text(`Please use ${number} as the payment reference.`, { size: 9, bold: true });
  }

  if (inv.notes) {
    L.space(12);
    L.text("NOTES", { size: 8, bold: true, color: MUTED });
    L.text(inv.notes, { size: 9 });
  }

  if (isQuote) {
    L.space(12);
    L.text(
      `This quotation is valid until ${inv.dueOn ?? "30 days from its date"}. Prices are in South African Rand.`,
      {
        size: 8,
        color: MUTED,
      }
    );
  }

  /* ---------------------------- marks and footer --------------------------- */

  const stamp = inv.status === "void" ? "VOID" : inv.status === "draft" ? "DRAFT" : null;
  L.pages.forEach((p, i) => {
    if (stamp) {
      p.drawText(stamp, {
        x: A4[0] / 2 - 150,
        y: A4[1] / 2 - 60,
        size: 110,
        font: fonts.bold,
        color: rgb(0.85, 0.1, 0.1),
        opacity: 0.15,
        rotate: degrees(35),
      });
    }
    p.drawLine({
      start: { x: MARGIN, y: MARGIN },
      end: { x: A4[0] - MARGIN, y: MARGIN },
      thickness: 0.4,
      color: RULE,
    });
    const foot = sanitize(`${title} ${number}  ·  page ${i + 1} of ${L.pages.length}`);
    p.drawText(foot, {
      x: A4[0] - MARGIN - fonts.regular.widthOfTextAtSize(foot, 7.5),
      y: MARGIN - 12,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return doc.save();
}
