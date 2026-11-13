import { describe, expect, it, vi } from "vitest";

import { guardPublicForm } from "@/lib/form-guard";

const req = () =>
  new Request("https://skrubbit.co.za/api/orders", {
    method: "POST",
    headers: { "cf-connecting-ip": "203.0.113.7" },
  });

describe("guardPublicForm", () => {
  it("lets a request through when no limiter or Turnstile secret is configured", async () => {
    expect(await guardPublicForm(req(), {}, "orders", "")).toBeNull();
  });

  it("answers 429 once the per-IP limit is reached", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const result = await guardPublicForm(req(), { FORM_LIMITER: { limit } }, "orders", "");
    expect(result?.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: "orders:203.0.113.7" });
  });

  it("keys orders and contact messages separately", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    await guardPublicForm(req(), { FORM_LIMITER: { limit } }, "contact", "");
    expect(limit).toHaveBeenCalledWith({ key: "contact:203.0.113.7" });
  });

  it("does not take the form down if the limiter itself fails", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("binding unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await guardPublicForm(req(), { FORM_LIMITER: { limit } }, "orders", "")).toBeNull();
  });

  it("refuses a missing Turnstile token once the secret is set", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await guardPublicForm(req(), { TURNSTILE_SECRET_KEY: "secret" }, "orders", "");
    expect(result?.status).toBe(403);
  });
});
