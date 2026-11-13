import { describe, expect, it } from "vitest";

import { LIMITS, clamp, normaliseItems, subtotalOf } from "@/lib/enquiries";

describe("clamp", () => {
  it("trims and caps strings", () => {
    expect(clamp("  hello  ", 10)).toBe("hello");
    expect(clamp("x".repeat(50), 5)).toBe("xxxxx");
  });

  it("turns anything that is not a string into an empty string", () => {
    expect(clamp(42, 10)).toBe("");
    expect(clamp(null, 10)).toBe("");
    expect(clamp({ name: "x" }, 10)).toBe("");
  });
});

describe("normaliseItems", () => {
  it("returns nothing for a cart that is not an array", () => {
    expect(normaliseItems(undefined)).toEqual([]);
    expect(normaliseItems("not a cart")).toEqual([]);
  });

  it("keeps a well-formed line as it is", () => {
    expect(normaliseItems([{ name: "Dishwash", size: "5L", qty: 2, price: 89.5 }])).toEqual([
      { name: "Dishwash", size: "5L", qty: 2, price: 89.5 },
    ]);
  });

  it("repairs bad quantities and prices instead of rejecting the order", () => {
    const [line] = normaliseItems([{ name: "Bleach", qty: -3, price: "abc" }]);
    expect(line.qty).toBe(1);
    expect(line.price).toBe(0);
  });

  it("floors fractional quantities and caps very large ones", () => {
    const [a, b] = normaliseItems([
      { name: "A", qty: 2.9, price: 1 },
      { name: "B", qty: 10_000_000, price: 1 },
    ]);
    expect(a.qty).toBe(2);
    expect(b.qty).toBe(100_000);
  });

  it("caps the number of lines and the length of text fields", () => {
    const cart = Array.from({ length: LIMITS.items + 20 }, () => ({
      name: "n".repeat(LIMITS.itemText + 50),
      qty: 1,
      price: 1,
    }));
    const items = normaliseItems(cart);
    expect(items).toHaveLength(LIMITS.items);
    expect(items[0].name).toHaveLength(LIMITS.itemText);
  });
});

describe("subtotalOf", () => {
  it("is computed from the lines, never taken from the client", () => {
    const items = normaliseItems([
      { name: "A", qty: 3, price: 10 },
      { name: "B", qty: 1, price: 25.5 },
    ]);
    expect(subtotalOf(items)).toBe(55.5);
  });

  it("is zero for an empty cart", () => {
    expect(subtotalOf([])).toBe(0);
  });
});
