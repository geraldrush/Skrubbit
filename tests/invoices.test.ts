import { describe, expect, it } from "vitest";

import {
  addDays,
  balance,
  daysOverdue,
  invoiceState,
  round2,
  totals,
  type Invoice,
} from "@/lib/invoices";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    kind: "invoice",
    number: "INV-0001",
    status: "issued",
    customerId: 1,
    customerName: "Test Customer",
    customerContact: "",
    customerAddress: "",
    customerEmail: "",
    customerVat: "",
    issuedOn: "2026-10-01",
    dueOn: "2026-10-31",
    reference: "",
    notes: "",
    vatRate: 0.15,
    tenderId: null,
    orderReference: null,
    quoteId: null,
    emailedAt: null,
    emailedTo: "",
    createdAt: "2026-10-01T08:00:00Z",
    subtotal: 1000,
    vat: 150,
    total: 1150,
    paid: 0,
    invoicedBy: null,
    ...overrides,
  } as Invoice;
}

describe("round2", () => {
  it("rounds to the cent without floating-point artefacts", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(5210.4299999)).toBe(5210.43);
    expect(round2(1.005)).toBe(1.01);
  });
});

describe("addDays", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 30)).toBe("2027-01-30");
  });
});

describe("totals", () => {
  it("rounds each line before summing, then adds VAT", () => {
    const result = totals(
      [
        { description: "Bleach 5L", unit: "each", quantity: 3, unitPrice: 33.333 },
        { description: "Delivery", unit: "each", quantity: 1, unitPrice: 150 },
      ],
      0.15
    );
    // 3 x 33.333 = 99.999, printed and summed as 100.00.
    expect(result).toEqual({ subtotal: 250, vat: 37.5, total: 287.5 });
  });

  it("charges no VAT when the rate is zero", () => {
    expect(totals([{ description: "Item", unit: "each", quantity: 2, unitPrice: 50 }], 0)).toEqual({
      subtotal: 100,
      vat: 0,
      total: 100,
    });
  });
});

describe("invoiceState", () => {
  const today = "2026-11-15";

  it("reports drafts and voids as they are", () => {
    expect(invoiceState(invoice({ status: "draft" }), today)).toBe("draft");
    expect(invoiceState(invoice({ status: "void" }), today)).toBe("void");
  });

  it("works out paid, part-paid, unpaid and overdue from payments and the due date", () => {
    expect(invoiceState(invoice({ paid: 1150, dueOn: "2026-10-31" }), today)).toBe("paid");
    expect(invoiceState(invoice({ paid: 0, dueOn: "2026-10-31" }), today)).toBe("overdue");
    expect(invoiceState(invoice({ paid: 500, dueOn: "2026-12-01" }), today)).toBe("part-paid");
    expect(invoiceState(invoice({ paid: 0, dueOn: "2026-12-01" }), today)).toBe("unpaid");
  });

  it("tracks quotes separately from invoices", () => {
    const quote = (o: Partial<Invoice>) => invoice({ kind: "quote", ...o });
    expect(invoiceState(quote({ invoicedBy: 7 }), today)).toBe("quote-accepted");
    expect(invoiceState(quote({ dueOn: "2026-11-01" }), today)).toBe("quote-expired");
    expect(invoiceState(quote({ dueOn: "2026-12-01" }), today)).toBe("quote-open");
  });
});

describe("balance and daysOverdue", () => {
  it("never reports a negative balance on an overpaid invoice", () => {
    expect(balance(invoice({ paid: 2000 }))).toBe(0);
    expect(balance(invoice({ paid: 150 }))).toBe(1000);
  });

  it("counts days past the due date, and zero before it", () => {
    expect(daysOverdue(invoice({ dueOn: "2026-10-31" }), "2026-11-15")).toBe(15);
    expect(daysOverdue(invoice({ dueOn: "2026-12-01" }), "2026-11-15")).toBe(0);
  });
});
