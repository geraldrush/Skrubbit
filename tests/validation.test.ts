import { describe, expect, it } from "vitest";

import { validateCustomer, validateDraft, validatePayment } from "@/lib/invoice-validation";
import { validateProductBody } from "@/lib/product-validation";

const variant = { size: "5L", sku: "SK-BL-5", price: 89.99 };

describe("validateProductBody", () => {
  it("accepts a complete product", () => {
    const result = validateProductBody({ name: "Bleach", category: "kitchen", variants: [variant] });
    expect("value" in result).toBe(true);
  });

  it("requires a name, a known category and at least one variant", () => {
    const result = validateProductBody({ name: "", category: "garage", variants: [] });
    expect("errors" in result && result.errors).toEqual([
      "Name is required.",
      expect.stringContaining("Category must be one of"),
      "At least one variant (size, SKU and price) is required.",
    ]);
  });

  it("rejects a zero price, which is what an empty price field becomes", () => {
    const result = validateProductBody({
      name: "Bleach",
      category: "kitchen",
      variants: [{ ...variant, price: "" }],
    });
    expect("errors" in result && result.errors).toContain("Variant 1: price must be greater than 0.");
  });

  it("rejects duplicate SKUs within a product", () => {
    const result = validateProductBody({
      name: "Bleach",
      category: "kitchen",
      variants: [variant, { ...variant, size: "1L" }],
    });
    expect("errors" in result && result.errors).toContain(
      "Variant SKUs must be unique within a product."
    );
  });
});

describe("validateCustomer", () => {
  it("requires a name and sensible payment terms", () => {
    const result = validateCustomer({ name: " ", termsDays: 400 });
    expect("errors" in result && result.errors).toHaveLength(2);
  });

  it("defaults payment terms to 30 days and caps field lengths", () => {
    const result = validateCustomer({ name: "SAPS Thohoyandou", notes: "n".repeat(5000) });
    if (!("value" in result)) throw new Error("expected a valid customer");
    expect(result.value.termsDays).toBe(30);
    expect(result.value.notes).toHaveLength(2000);
  });
});

describe("validateDraft", () => {
  const line = { description: "Bleach 5L", quantity: 2, unitPrice: 89.99 };

  it("accepts a draft and drops blank editor rows", () => {
    const result = validateDraft({ customerId: 3, lines: [line, { description: "" }] });
    if (!("value" in result)) throw new Error("expected a valid draft");
    expect(result.value.kind).toBe("invoice");
    expect(result.value.lines).toHaveLength(1);
  });

  it("allows a negative price (a discount line) but not a zero or negative quantity", () => {
    const discount = validateDraft({
      customerId: 3,
      lines: [line, { description: "Discount", quantity: 1, unitPrice: -20 }],
    });
    expect("value" in discount).toBe(true);

    const inverted = validateDraft({ customerId: 3, lines: [{ ...line, quantity: -2 }] });
    expect("errors" in inverted && inverted.errors).toContain(
      "Every line needs a quantity above zero."
    );
  });

  it("rejects a missing customer and a due date before the issue date", () => {
    const result = validateDraft({ lines: [line], issuedOn: "2026-11-10", dueOn: "2026-11-01" });
    expect("errors" in result && result.errors).toEqual([
      "Choose a customer.",
      "The due date is before the issue date.",
    ]);
  });

  it("ignores malformed dates rather than storing them", () => {
    const result = validateDraft({ customerId: 3, lines: [line], issuedOn: "2026-13-45" });
    if (!("value" in result)) throw new Error("expected a valid draft");
    expect(result.value.issuedOn).toBeNull();
  });
});

describe("validatePayment", () => {
  it("requires a date and a positive amount", () => {
    const result = validatePayment({ amount: 0 });
    expect("errors" in result && result.errors).toHaveLength(2);
  });

  it("falls back to EFT for an unknown payment method", () => {
    const result = validatePayment({ receivedOn: "2026-11-12", amount: 500, method: "bitcoin" });
    if (!("value" in result)) throw new Error("expected a valid payment");
    expect(result.value.method).toBe("eft");
  });
});
