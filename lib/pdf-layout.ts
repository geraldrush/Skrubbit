/**
 * Shared page furniture for the generated PDFs.
 *
 * Extracted from lib/pack-pdf.ts so the tender pack and the company profile
 * lay out identically — same margins, same wrapping, same table rules — rather
 * than drifting apart as two hand-tuned copies.
 */

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

/* ------------------------------ page metrics ---------------------------- */

export const A4: [number, number] = [595.28, 841.89];
export const MARGIN = 50;
export const CONTENT_W = A4[0] - MARGIN * 2;
export const BODY = 10;
export const LEADING = 14;

export const INK = rgb(0, 0, 0);
export const MUTED = rgb(0.38, 0.38, 0.38);
export const RULE = rgb(0.6, 0.6, 0.6);
export const HEADER_FILL = rgb(0.94, 0.94, 0.93);

/**
 * Standard fonts are WinAnsi-encoded, and pdf-lib throws on anything outside
 * that set. User-entered text can contain anything, so map the punctuation we
 * actually emit and drop the rest rather than failing the whole document.
 */
export function sanitize(input: string): string {
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

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Cursor-based page writer: sections append, pages break automatically. */
export class Layout {
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
