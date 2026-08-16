/**
 * Builds the whole tender pack as a single PDF, certificates included.
 *
 * Replaces the print-to-PDF route for the final artefact. Everything the pack
 * contains is text and tables, which pdf-lib draws directly, and the stored
 * certificates are already PDFs or images — so they can be appended as further
 * pages rather than handed over as a separate download to combine by hand
 * before a deadline.
 *
 * It still does NOT produce SBD 1/4/6.1/8/9. Those are official National
 * Treasury forms that arrive with the tender and must be completed and signed
 * on the originals; the pack indexes them and prints a divider to file them
 * behind.
 */

import {
  degrees,
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { formatZAR } from "@/lib/utils";
import type { CompanyProfile } from "@/lib/company";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatDateTime,
  priceTotals,
  VAT_RATE,
  type CompanyDocument,
  type ItemCategory,
  type PricingLine,
  type Tender,
  type TenderItem,
} from "@/lib/tenders";

/* ------------------------------ page metrics ---------------------------- */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const CONTENT_W = A4[0] - MARGIN * 2;
const BODY = 10;
const LEADING = 14;

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.38, 0.38, 0.38);
const RULE = rgb(0.6, 0.6, 0.6);
const HEADER_FILL = rgb(0.94, 0.94, 0.93);

/**
 * Standard fonts are WinAnsi-encoded, and pdf-lib throws on anything outside
 * that set. User-entered text can contain anything, so map the punctuation we
 * actually emit and drop the rest rather than failing the whole document.
 */
function sanitize(input: string): string {
  return input
    .replace(/ /g, " ")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–]/g, "-")
    .replace(/[—]/g, "—")
    .replace(/…/g, "...")
    .replace(/•/g, "•")
    .replace(/✓|☑/g, "[x]")
    .replace(/☐/g, "[ ]")
    // Anything still outside Latin-1 would throw at draw time.
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff—•]/g, "");
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Cursor-based page writer: sections append, pages break automatically. */
class Layout {
  readonly pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts
  ) {
    this.newPage();
  }

  newPage(): void {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    // Leave room for the footer rule.
    this.y = A4[1] - MARGIN;
  }

  /** Starts a fresh page unless the current one is untouched. */
  section(): void {
    if (this.y < A4[1] - MARGIN) this.newPage();
  }

  private ensure(height: number): void {
    if (this.y - height < MARGIN + 24) this.newPage();
  }

  space(h: number): void {
    this.y -= h;
  }

  get cursor(): number {
    return this.y;
  }

  wrap(text: string, size: number, font: PDFFont, width: number): string[] {
    const lines: string[] = [];
    for (const raw of sanitize(text).split("\n")) {
      if (!raw.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of raw.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > width && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  text(
    content: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      leading?: number;
      x?: number;
      width?: number;
    } = {}
  ): void {
    const size = opts.size ?? BODY;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const leading = opts.leading ?? LEADING;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_W;

    for (const line of this.wrap(content, size, font, width)) {
      this.ensure(leading);
      if (line) {
        this.page.drawText(line, {
          x,
          y: this.y - size,
          size,
          font,
          color: opts.color ?? INK,
        });
      }
      this.y -= leading;
    }
  }

  heading(content: string, size = 15): void {
    this.ensure(size + 12);
    this.page.drawText(sanitize(content), {
      x: MARGIN,
      y: this.y - size,
      size,
      font: this.fonts.bold,
      color: INK,
    });
    this.y -= size + 10;
  }

  rule(): void {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_W, y: this.y },
      thickness: 0.75,
      color: RULE,
    });
    this.y -= 10;
  }

  /**
   * A bordered table. Column widths are fractions of the content width, and a
   * row that would split across a page break moves whole to the next page.
   */
  table(opts: {
    head: string[];
    rows: string[][];
    widths: number[];
    align?: ("left" | "right")[];
    boldRows?: number[];
  }): void {
    const size = 9;
    const pad = 4;
    const cols = opts.widths.map((w) => w * CONTENT_W);
    const align = opts.align ?? opts.head.map(() => "left" as const);

    const drawRow = (cells: string[], bold: boolean, fill: boolean) => {
      const wrapped = cells.map((cell, i) =>
        this.wrap(cell, size, bold ? this.fonts.bold : this.fonts.regular, cols[i] - pad * 2)
      );
      const height = Math.max(...wrapped.map((w) => w.length)) * (size + 3) + pad * 2;
      this.ensure(height);

      let x = MARGIN;
      cells.forEach((_, i) => {
        if (fill) {
          this.page.drawRectangle({
            x,
            y: this.y - height,
            width: cols[i],
            height,
            color: HEADER_FILL,
          });
        }
        this.page.drawRectangle({
          x,
          y: this.y - height,
          width: cols[i],
          height,
          borderColor: RULE,
          borderWidth: 0.5,
        });
        const font = bold ? this.fonts.bold : this.fonts.regular;
        wrapped[i].forEach((line, li) => {
          const textWidth = font.widthOfTextAtSize(line, size);
          const tx = align[i] === "right" ? x + cols[i] - pad - textWidth : x + pad;
          this.page.drawText(line, {
            x: tx,
            y: this.y - pad - size - li * (size + 3),
            size,
            font,
            color: INK,
          });
        });
        x += cols[i];
      });
      this.y -= height;
    };

    drawRow(opts.head, true, true);
    opts.rows.forEach((row, i) => drawRow(row, opts.boldRows?.includes(i) ?? false, false));
    this.y -= 6;
  }

  /** A ruled line for a hand signature. */
  signature(name: string, capacity: string): void {
    this.ensure(70);
    this.y -= 34;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + 220, y: this.y },
      thickness: 0.75,
      color: INK,
    });
    this.y -= 12;
    this.text(name, { bold: true });
    this.text(capacity, { color: MUTED });
  }

  /** Big centred text, for divider sheets. */
  divider(letter: string, title: string, items: string[]): void {
    this.newPage();
    const centre = (content: string, size: number, font: PDFFont, y: number) => {
      const clean = sanitize(content);
      const w = font.widthOfTextAtSize(clean, size);
      this.page.drawText(clean, {
        x: (A4[0] - w) / 2,
        y,
        size,
        font,
        color: INK,
      });
    };
    centre(letter, 72, this.fonts.bold, A4[1] / 2 + 120);
    centre(title, 24, this.fonts.bold, A4[1] / 2 + 60);
    let y = A4[1] / 2 + 20;
    for (const item of items) {
      centre(item, 10, this.fonts.regular, y);
      y -= 16;
    }
    this.y = MARGIN; // consumed
  }
}

/* -------------------------------- the pack ------------------------------ */

export interface PackData {
  tender: Tender;
  items: TenderItem[];
  documents: CompanyDocument[];
  pricing: PricingLine[];
  profile: CompanyProfile;
  /** Certificate bytes keyed by document id, already fetched from R2. */
  files: Map<number, { bytes: Uint8Array; type: string }>;
  today: string;
}

function longDate(today: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const [y, m, d] = today.split("-");
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

export async function buildPackPdf(data: PackData): Promise<Uint8Array> {
  const { tender, items, documents, pricing, profile, files, today } = data;

  const doc = await PDFDocument.create();
  doc.setTitle(`${tender.reference} — ${tender.title}`);
  doc.setProducer("Skrubb-it tender console");

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const L = new Layout(doc, fonts);
  const totals = priceTotals(pricing);
  const payable = profile.vatRegistered ? totals.incl : totals.excl;
  const company = profile.legalName || "[Registered company name]";

  const csd = documents.find((d) => d.kind === "csd_report");
  const bbbee = documents.find((d) => d.kind === "bbbee");
  const taxPin = documents.find((d) => d.kind === "tax_pin");

  const required = items.filter((i) => i.required);
  const byCategory = new Map<ItemCategory, TenderItem[]>();
  for (const item of required) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const categories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  /* ------------------------------ cover letter --------------------------- */
  L.text(company, { size: 17, bold: true, leading: 21 });
  if (profile.tradingName) L.text(`Trading as ${profile.tradingName}`, { color: MUTED });
  L.text(profile.physicalAddress || "[Physical address]", { color: MUTED });
  L.text(
    [profile.phone, profile.email, profile.website].filter(Boolean).join("  ·  ") ||
      "[Contact details]",
    { color: MUTED }
  );
  L.text(
    `Reg. no: ${profile.registrationNumber || "[Registration number]"}${
      profile.vatRegistered && profile.vatNumber ? `   ·   VAT no: ${profile.vatNumber}` : ""
    }`,
    { color: MUTED }
  );
  L.space(6);
  L.rule();
  L.space(10);

  L.text(longDate(today));
  L.space(10);
  L.text(tender.department || "[Issuing department]", { bold: true });
  L.text("Attention: Supply Chain Management");
  L.space(12);
  L.text(`RE: ${tender.reference} — ${tender.title}`, { bold: true, size: 11, leading: 16 });
  L.space(8);

  L.text("Dear Sir / Madam,");
  L.space(6);
  L.text(
    `${company} hereby submits its bid in response to the above tender. We confirm that we have read and understood the tender document, the conditions of bid and the specifications, and that our offer is made in full compliance with them.`
  );
  L.space(6);
  L.text(
    `We are registered on the Central Supplier Database${
      csd?.reference ? ` under supplier number ${csd.reference}` : ""
    } and our tax affairs are in order with the South African Revenue Service.${
      bbbee?.bbbeeLevel
        ? ` We are a Level ${bbbee.bbbeeLevel} B-BBEE contributor, and the supporting certificate is enclosed.`
        : ""
    }`
  );
  L.space(6);
  L.text(
    totals.excl > 0
      ? `Our pricing is set out in the enclosed pricing schedule and is ${formatZAR(payable)}${
          profile.vatRegistered ? " including VAT" : ". We are not registered for VAT"
        }. This offer is valid for the period stipulated in the tender document, and we confirm our capacity to supply and deliver within the required timeframes.`
      : "Our pricing is set out in the enclosed pricing schedule [pricing to be completed]. This offer is valid for the period stipulated in the tender document."
  );
  L.space(6);
  L.text(
    "All mandatory returnable documents are enclosed and indexed in the contents page that follows. We trust our submission is favourably received and remain available for any clarification."
  );
  L.space(6);
  L.text("Yours faithfully,");
  L.signature(
    profile.signatoryName || "[Name of signatory]",
    `${profile.signatoryPosition || "[Capacity]"}, duly authorised on behalf of ${company}`
  );
  L.space(6);
  L.text("This letter must be signed by hand before submission.", {
    size: 8,
    color: MUTED,
  });

  /* -------------------------------- contents ----------------------------- */
  L.section();
  L.heading("Table of contents");
  L.text(`${tender.reference} — ${tender.title}`, { color: MUTED });
  L.text(`Closing: ${formatDateTime(tender.closingAt)}`, { color: MUTED });
  L.space(10);

  const tocRows: string[][] = [];
  categories.forEach((category, ci) => {
    const tab = String.fromCharCode(65 + ci);
    tocRows.push([tab, CATEGORY_LABELS[category].toUpperCase(), ""]);
    (byCategory.get(category) ?? []).forEach((item, ii) => {
      tocRows.push([
        `${tab}${ii + 1}`,
        item.label + (item.signatureRequired ? "  (signature required)" : ""),
        item.attached ? "[x]" : "[ ]",
      ]);
    });
  });
  L.table({
    head: ["Tab", "Document", "Included"],
    rows: tocRows,
    widths: [0.1, 0.72, 0.18],
  });

  /* --------------------------- company particulars ----------------------- */
  L.section();
  L.heading("Company profile");
  L.table({
    head: ["Item", "Detail"],
    rows: [
      ["Registered name", profile.legalName || "—"],
      ["Trading name", profile.tradingName || "—"],
      ["Registration number", profile.registrationNumber || "—"],
      ["VAT number", profile.vatRegistered ? profile.vatNumber || "—" : "Not VAT registered"],
      ["CSD supplier number", csd?.reference || "—"],
      ["B-BBEE level", bbbee?.bbbeeLevel ? `Level ${bbbee.bbbeeLevel}` : "—"],
      [
        "Tax compliance",
        taxPin?.expiresOn ? `PIN valid to ${taxPin.expiresOn}` : taxPin ? "PIN on file" : "—",
      ],
      ["Physical address", profile.physicalAddress || "—"],
      ["Postal address", profile.postalAddress || "—"],
      ["Telephone", profile.phone || "—"],
      ["Email", profile.email || "—"],
      [
        "Contact person",
        [profile.signatoryName, profile.signatoryPosition].filter(Boolean).join(", ") || "—",
      ],
    ],
    widths: [0.32, 0.68],
  });
  L.space(6);

  const profileText = tender.profileOverride || profile.profileText;
  if (profileText.trim()) {
    L.text(profileText);
  } else {
    L.text("[Company profile not yet written.]", { color: MUTED });
  }

  /* -------------------------------- methodology -------------------------- */
  L.section();
  L.heading("Methodology and work plan");
  L.text(
    tender.methodology.trim() || "[Methodology not yet written.]",
    tender.methodology.trim() ? {} : { color: MUTED }
  );

  /* -------------------------------- experience --------------------------- */
  L.section();
  L.heading("Relevant experience");
  L.text(
    tender.experience.trim() || "[Relevant experience not yet written.]",
    tender.experience.trim() ? {} : { color: MUTED }
  );

  /* --------------------------- enclosure schedule ------------------------ */
  L.section();
  L.heading("Schedule of enclosed documents");
  L.table({
    head: ["No.", "Document", "Reference", "Valid until", "Certification"],
    rows: documents.length
      ? documents.map((d, i) => [
          String(i + 1),
          d.label + (d.bbbeeLevel ? ` — Level ${d.bbbeeLevel}` : ""),
          d.reference || "—",
          d.expiresOn ?? "No expiry",
          d.requiresCertification
            ? d.certifiedOn
              ? `Certified ${d.certifiedOn}`
              : "TO BE CERTIFIED"
            : "Not required",
        ])
      : [["—", "[No company documents recorded.]", "", "", ""]],
    widths: [0.07, 0.36, 0.2, 0.16, 0.21],
  });

  /* ---------------------------- pricing schedule ------------------------- */
  L.section();
  L.heading("Pricing schedule");
  L.text(`${tender.reference} — ${tender.title}`, { color: MUTED });
  L.text(
    `All amounts in South African Rand. ${
      profile.vatRegistered
        ? `VAT at ${(VAT_RATE * 100).toFixed(0)}%.`
        : "Not registered for VAT — no VAT is charged."
    }`,
    { color: MUTED }
  );
  L.space(10);

  const priceRows = pricing.length
    ? pricing.map((line, i) => [
        String(i + 1),
        line.description,
        line.unit,
        String(line.quantity),
        formatZAR(line.unitPrice),
        formatZAR(line.quantity * line.unitPrice),
      ])
    : [["", "[No pricing lines captured.]", "", "", "", ""]];

  const totalRows: string[][] = profile.vatRegistered
    ? [
        ["", "", "", "", "Subtotal (excl VAT)", formatZAR(totals.excl)],
        ["", "", "", "", `VAT @ ${(VAT_RATE * 100).toFixed(0)}%`, formatZAR(totals.vat)],
        ["", "", "", "", "Total (incl VAT)", formatZAR(totals.incl)],
      ]
    : [["", "", "", "", "Total (no VAT — not VAT registered)", formatZAR(totals.excl)]];

  L.table({
    head: ["Item", "Description", "Unit", "Qty", "Unit price", "Amount"],
    rows: [...priceRows, ...totalRows],
    widths: [0.07, 0.37, 0.12, 0.1, 0.17, 0.17],
    align: ["left", "left", "left", "right", "right", "right"],
    boldRows: priceRows.length === 1 && !pricing.length
      ? []
      : totalRows.map((_, i) => priceRows.length + i),
  });

  L.signature(
    profile.signatoryName || "[Name]",
    profile.signatoryPosition || "[Capacity]"
  );
  L.space(4);
  L.text(
    "Transfer these amounts onto the official SBD 3.1 / 3.2 / 3.3 pricing form supplied with the tender, and sign it. This schedule supports that form; it does not replace it.",
    { size: 8, color: MUTED }
  );

  /* --------------------------------- dividers ---------------------------- */
  categories.forEach((category, ci) => {
    L.divider(
      String.fromCharCode(65 + ci),
      CATEGORY_LABELS[category],
      (byCategory.get(category) ?? []).map((i) => i.label)
    );
  });

  /* ------------- footers on everything generated so far ------------------ */
  const generatedCount = L.pages.length;
  L.pages.forEach((page, i) => {
    page.drawLine({
      start: { x: MARGIN, y: MARGIN - 8 },
      end: { x: MARGIN + CONTENT_W, y: MARGIN - 8 },
      thickness: 0.5,
      color: RULE,
    });
    const left = sanitize(`${company}  ·  ${tender.reference}`);
    page.drawText(left, {
      x: MARGIN,
      y: MARGIN - 20,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
    const right = `Page ${i + 1} of ${generatedCount}`;
    const w = fonts.regular.widthOfTextAtSize(right, 7.5);
    page.drawText(right, {
      x: MARGIN + CONTENT_W - w,
      y: MARGIN - 20,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
  });

  /* ------------------------ appended certificates ------------------------ */
  for (const record of documents) {
    const file = files.get(record.id);
    if (!file) continue;

    // A separator page identifies what follows, since a scanned certificate
    // carries no context of its own.
    const sep = doc.addPage(A4);
    const title = sanitize(record.label);
    const titleWidth = fonts.bold.widthOfTextAtSize(title, 18);
    sep.drawText(title, {
      x: (A4[0] - titleWidth) / 2,
      y: A4[1] / 2,
      size: 18,
      font: fonts.bold,
      color: INK,
    });
    const sub = sanitize(
      [
        record.reference ? `Ref: ${record.reference}` : "",
        record.expiresOn ? `Valid to ${record.expiresOn}` : "",
      ]
        .filter(Boolean)
        .join("   ·   ")
    );
    if (sub) {
      const subWidth = fonts.regular.widthOfTextAtSize(sub, 10);
      sep.drawText(sub, {
        x: (A4[0] - subWidth) / 2,
        y: A4[1] / 2 - 24,
        size: 10,
        font: fonts.regular,
        color: MUTED,
      });
    }

    const added: PDFPage[] = [sep];

    try {
      if (file.type === "application/pdf") {
        const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
        const copied = await doc.copyPages(src, src.getPageIndices());
        for (const page of copied) {
          doc.addPage(page);
          added.push(page);
        }
      } else {
        const image =
          file.type === "image/png"
            ? await doc.embedPng(file.bytes)
            : await doc.embedJpg(file.bytes);
        const page = doc.addPage(A4);
        // Fit inside the margins, preserving aspect ratio.
        const scale = Math.min(
          CONTENT_W / image.width,
          (A4[1] - MARGIN * 2) / image.height,
          1
        );
        const w = image.width * scale;
        const h = image.height * scale;
        page.drawImage(image, {
          x: (A4[0] - w) / 2,
          y: (A4[1] - h) / 2,
          width: w,
          height: h,
        });
        added.push(page);
      }
    } catch {
      // A certificate that can't be parsed must not fail the whole pack.
      const note = doc.addPage(A4);
      const msg = sanitize(
        `[${record.label}: the uploaded file could not be merged. Print it separately.]`
      );
      note.drawText(msg, {
        x: MARGIN,
        y: A4[1] / 2,
        size: 11,
        font: fonts.regular,
        color: INK,
        maxWidth: CONTENT_W,
      });
      added.push(note);
    }

    // The working marker: which copies still need a Commissioner of Oaths.
    // Nothing here certifies anything — it is a reminder, drawn only while the
    // document is still uncertified.
    if (record.requiresCertification && !record.certifiedOn) {
      for (const page of added) {
        const { width, height } = page.getSize();
        page.drawText("TO BE CERTIFIED", {
          x: width * 0.12,
          y: height * 0.32,
          size: 46,
          font: fonts.bold,
          color: rgb(0.85, 0.2, 0.2),
          rotate: degrees(38),
          opacity: 0.22,
        });
      }
    }
  }

  return await doc.save();
}
