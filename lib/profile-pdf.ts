/**
 * The company profile as a downloadable PDF, on the Skrubb-it letterhead.
 *
 * Supplier databases ask for "company profile and letterhead" as one document,
 * and the answer changes as the business does — turnover, references, what can
 * honestly be produced. Generating it from the same D1 record the tender pack
 * reads means it is edited once, in /admin, and every copy that goes out is
 * current.
 *
 * Drawn with pdf-lib rather than printed from the browser so the output is a
 * real file the admin can attach to an email, with the same page furniture as
 * the tender pack.
 */

import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

import type { CompanyProfile } from "@/lib/company";
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
import { parseProfile } from "@/lib/profile-text";

/** From the logo. The rule under the letterhead is the brand in two strokes. */
const BRAND_YELLOW = rgb(1, 0.8, 0);
const BRAND_RED = rgb(0.89, 0.02, 0.07);
/** The pale wash behind the B-BBEE pill. */
const BADGE_FILL = rgb(1, 0.976, 0.863);

/**
 * Town and province from a full street address.
 *
 * The premises are also a home. "Khubvi, Limpopo" tells a buyer where we are
 * and what it means for delivery; the street number tells a stranger on the
 * internet where the director sleeps.
 */
function locality(address: string): string {
  const NOISE = /^(street|str|road|rd|avenue|ave|drive|dr|stand|unit|site|no|block|section|village)$/i;
  const words = address
    .split(/[\s,\n]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    // Street numbers and postal codes carry no useful meaning for a buyer and
    // are exactly the part that pinpoints a home.
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !NOISE.test(w));

  // The same town often appears twice (postal and physical run together).
  const unique = words.filter((w, i) => i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase());

  // Everything before the last two words is the street itself.
  const tail = unique.slice(-2);
  return tail
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(", ");
}

/* --------------------------- letterhead furniture ------------------------ */

/** The current page — Layout appends, so the last one is the live one. */
const live = (L: Layout) => L.pages[L.pages.length - 1];

/**
 * Draws text with tracking.
 *
 * pdf-lib has no letter-spacing, and letter-spaced caps are most of what makes
 * the printed letterhead look considered rather than typed. Drawing glyph by
 * glyph is cheap at heading sizes.
 */
function tracked(
  page: ReturnType<typeof live>,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  spacing: number,
  color = INK
): number {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + spacing;
  }
  return cx - x;
}

/**
 * A section heading: letter-spaced caps over a yellow rule.
 *
 * The rule is the point — it is the brand doing structural work, and it is
 * what separates a profile that looks designed from one that looks typed.
 */
function sectionHeading(L: Layout, fonts: Fonts, text: string): void {
  L.space(14);
  const page = live(L);
  const y = L.cursor;
  tracked(page, sanitize(text.toUpperCase()), MARGIN, y - 9, 9.5, fonts.bold, 1.1);
  page.drawRectangle({
    x: MARGIN,
    y: y - 15,
    width: CONTENT_W,
    height: 1.2,
    color: BRAND_YELLOW,
  });
  L.space(24);
}

/**
 * The particulars table, drawn to match the printed letterhead.
 *
 * Deliberately not Layout.table, which boxes every cell and fills a grey header
 * — right for a tender pack's pricing schedule, too heavy for a profile. Here
 * the label is muted, the value is ink, and a hairline separates the rows.
 */
function particulars(L: Layout, fonts: Fonts, rows: string[][]): void {
  const labelW = CONTENT_W * 0.32;
  const valueW = CONTENT_W - labelW;
  const size = 9;
  const leading = size + 3.5;

  for (const [label, value] of rows) {
    const wrapped = L.wrap(value, size, fonts.regular, valueW - 6);
    const height = Math.max(wrapped.length * leading, leading) + 9;
    L.space(0);
    if (L.cursor - height < MARGIN + 40) L.newPage();

    const page = live(L);
    const top = L.cursor;
    page.drawText(sanitize(label), {
      x: MARGIN,
      y: top - size - 2,
      size,
      font: fonts.regular,
      color: MUTED,
    });
    wrapped.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN + labelW,
        y: top - size - 2 - i * leading,
        size,
        font: fonts.regular,
        color: INK,
      });
    });
    page.drawLine({
      start: { x: MARGIN, y: top - height + 2 },
      end: { x: MARGIN + CONTENT_W, y: top - height + 2 },
      thickness: 0.4,
      color: RULE,
    });
    L.space(height);
  }
}

export interface ProfilePdfData {
  profile: CompanyProfile;
  /**
   * Who is going to read it.
   *
   * "public" is the copy anyone can download from the website. It omits the
   * things that are only ever needed inside a submission and that do real harm
   * loose on the open web: the bank account, which with a company name is all
   * an invoice-redirection fraud needs; the income tax number; the street
   * address of premises that are also somebody's home; and the director's
   * personal contact details.
   *
   * "internal" is the complete document, downloaded from /admin and attached
   * to a specific supplier database or tender, where every field is asked for
   * and the recipient is known.
   */
  audience?: "public" | "internal";
  /** The logo, already fetched. Optional — the letterhead still sets without it. */
  logo?: Uint8Array;
  today: string;
}

export async function buildProfilePdf(data: ProfilePdfData): Promise<Uint8Array> {
  const { profile, logo, today, audience = "internal" } = data;
  const isPublic = audience === "public";
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  doc.setTitle(`${profile.legalName} — Company Profile`);
  doc.setAuthor(profile.legalName);
  doc.setSubject("Company profile");

  const L = new Layout(doc, fonts);
  const page = L.pages[0];
  const top = A4[1] - MARGIN;

  /* ----------------------------- letterhead ------------------------------ */

  let logoBottom = top;
  if (logo) {
    try {
      const img = await doc.embedPng(logo);
      // Fit the mark inside a fixed box rather than trusting its aspect: a
      // square source with white margins would otherwise draw 150pt tall and
      // sit on top of the brand rule.
      const boxW = 150;
      const boxH = 34;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: MARGIN, y: top - h, width: w, height: h });
      logoBottom = top - h;
    } catch {
      // A logo that will not embed must not cost the whole document.
    }
  }

  // Particulars block, right-aligned against the margin.
  const right = [
    profile.legalName,
    profile.registrationNumber ? `Reg. ${profile.registrationNumber}` : "",
    ...(isPublic
      ? [locality(profile.physicalAddress)]
      : profile.physicalAddress.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3)),
    [profile.phone, profile.website].filter(Boolean).join("  ·  "),
  ].filter(Boolean);

  let ry = top - 6;
  right.forEach((line, i) => {
    const size = i === 0 ? 10 : 8.5;
    const font = i === 0 ? fonts.bold : fonts.regular;
    const text = sanitize(line);
    page.drawText(text, {
      x: A4[0] - MARGIN - font.widthOfTextAtSize(text, size),
      y: ry,
      size,
      font,
      color: i === 0 ? INK : MUTED,
    });
    ry -= i === 0 ? 13 : 11;
  });

  // The brand rule: yellow running into red, as on the printed letterhead.
  // Below whichever runs lower: the mark, or the particulars block.
  const ruleY = Math.min(ry, logoBottom) - 12;
  page.drawRectangle({ x: MARGIN, y: ruleY, width: CONTENT_W * 0.62, height: 7, color: BRAND_YELLOW });
  page.drawRectangle({
    x: MARGIN + CONTENT_W * 0.62, y: ruleY,
    width: CONTENT_W * 0.38, height: 7, color: BRAND_RED,
  });

  L.space(top - ruleY + 22);

  /* ------------------------------- content ------------------------------- */

  const page1 = live(L);
  tracked(page1, "COMPANY PROFILE", MARGIN, L.cursor - 14, 14, fonts.bold, 1.6);
  L.space(24);

  // The B-BBEE line as a bordered pill, as on the printed letterhead.
  if (profile.bbbeeStatus) {
    const badge = sanitize(profile.bbbeeStatus.split(".")[0]);
    const w = fonts.bold.widthOfTextAtSize(badge, 8.5) + 16;
    const page = live(L);
    page.drawRectangle({
      x: MARGIN,
      y: L.cursor - 15,
      width: Math.min(w, CONTENT_W),
      height: 17,
      color: BADGE_FILL,
      borderColor: BRAND_YELLOW,
      borderWidth: 0.8,
    });
    page.drawText(badge, {
      x: MARGIN + 8,
      y: L.cursor - 10.5,
      size: 8.5,
      font: fonts.bold,
      color: INK,
    });
    L.space(26);
  }

  const blocks = parseProfile(profile.profileText);
  for (const [i, block] of blocks.entries()) {
    const next = blocks[i + 1];
    if (block.kind === "heading") sectionHeading(L, fonts, block.text);
    else if (block.kind === "bullet")
      L.text(`\u2022  ${block.text}`, { size: 9.5, leading: 14 });
    else {
      L.text(block.text, { size: 9.5, leading: 14.5 });
      L.space(7);
    }
    if (block.kind === "bullet" && next?.kind !== "bullet") L.space(8);
  }

  sectionHeading(L, fonts, "Registered particulars");
  particulars(L, fonts, [
    ["Registered name", profile.legalName],
    ["CIPC registration", profile.registrationNumber],
    ["Income tax number", isPublic ? "Supplied with quotations" : profile.taxNumber],
    ["CSD supplier number", profile.csdNumber],
    [
      "VAT registration",
      profile.vatRegistered
        ? profile.vatNumber
        : "Not registered for VAT. All prices quoted are VAT-exclusive.",
    ],
    ["B-BBEE status", profile.bbbeeStatus],
    ["Annual turnover", profile.annualTurnover],
    ["Banking", isPublic ? "Supplied on award, on a company letterhead" : profile.bankDetails],
    [
      "Address",
      isPublic ? locality(profile.physicalAddress) : profile.physicalAddress.replace(/\n/g, ", "),
    ],
    [
      "Contact",
      isPublic
        ? [profile.phone, profile.email].filter(Boolean).join(" - ")
        : [profile.signatoryName, profile.signatoryPosition, profile.phone, profile.email]
            .filter(Boolean)
            .join(" - "),
    ],
  ].filter((r) => r[1]));

  if (isPublic) {
    sectionHeading(L, fonts, "Verifying us");
    L.text(
      `${profile.legalName} is registered with CIPC and listed on the National Treasury Central Supplier Database, where our tax compliance, banking and B-BBEE status can be verified by any organ of state. Certified copies of every certificate accompany a quotation.`,
      { size: 9.5, leading: 14.5 }
    );
  } else {
    sectionHeading(L, fonts, "Declaration");
    L.text(
      `I certify that the information given in this profile is true and correct, and that ${profile.legalName} is able to supply the goods and services for which it is registering.`,
      { size: 9.5, leading: 14.5 }
    );
    L.signature(profile.signatoryName || "", profile.signatoryPosition || "Director");
  }

  /* ------------------------------- footers ------------------------------- */

  const foot = [
    profile.legalName,
    profile.registrationNumber ? `Reg. ${profile.registrationNumber}` : "",
    profile.csdNumber ? `CSD ${profile.csdNumber}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  L.pages.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN + 16 },
      end: { x: A4[0] - MARGIN, y: MARGIN + 16 },
      thickness: 0.5,
      color: RULE,
    });
    p.drawText(sanitize(foot), { x: MARGIN, y: MARGIN + 5, size: 7.5, font: fonts.regular, color: MUTED });
    const right = `${today}   Page ${i + 1} of ${L.pages.length}`;
    p.drawText(right, {
      x: A4[0] - MARGIN - fonts.regular.widthOfTextAtSize(right, 7.5),
      y: MARGIN + 5,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return doc.save();
}
