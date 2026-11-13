import { describe, expect, it } from "vitest";

import {
  checkCredentials,
  createSessionToken,
  hashPassword,
  isAdminRequest,
  sessionCookieHeader,
  verifySessionToken,
} from "@/lib/admin-auth";

const SECRET = "test-session-secret";
const USERNAME = "admin@example.com";
const PASSWORD = "correct horse battery staple 2026";

async function env() {
  return { ADMIN_USERNAME: USERNAME, ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD) };
}

describe("password hashing", () => {
  it("stores PBKDF2 hashes with a random salt, never the password", async () => {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    expect(a).toMatch(/^pbkdf2\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(a).not.toContain(PASSWORD);
    expect(a).not.toBe(b);
  });

  it("accepts the right credentials, case-insensitively on the username", async () => {
    const e = await env();
    expect(await checkCredentials(USERNAME, PASSWORD, e)).toBe(true);
    expect(await checkCredentials("  ADMIN@example.com ", PASSWORD, e)).toBe(true);
  });

  it("rejects a wrong password or username", async () => {
    const e = await env();
    expect(await checkCredentials(USERNAME, "wrong password", e)).toBe(false);
    expect(await checkCredentials("someone@else.com", PASSWORD, e)).toBe(false);
  });

  it("fails closed when no admin is configured", async () => {
    expect(await checkCredentials(USERNAME, PASSWORD, {})).toBe(false);
  });
});

describe("session tokens", () => {
  it("verifies a token it issued", async () => {
    const { ADMIN_PASSWORD_HASH: hash } = await env();
    const token = await createSessionToken(SECRET, hash);
    expect(await verifySessionToken(token, SECRET, hash)).toBe(true);
  });

  it("rejects a token with an edited expiry", async () => {
    const { ADMIN_PASSWORD_HASH: hash } = await env();
    const [, signature] = (await createSessionToken(SECRET, hash)).split(".");
    const forged = `${Math.floor(Date.now() / 1000) + 10 * 365 * 86400}.${signature}`;
    expect(await verifySessionToken(forged, SECRET, hash)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const { ADMIN_PASSWORD_HASH: hash } = await env();
    const token = await createSessionToken("another-secret", hash);
    expect(await verifySessionToken(token, SECRET, hash)).toBe(false);
  });

  it("invalidates every session when the password changes", async () => {
    const oldHash = await hashPassword(PASSWORD);
    const newHash = await hashPassword("a brand new password 2026");
    const token = await createSessionToken(SECRET, oldHash);
    expect(await verifySessionToken(token, SECRET, newHash)).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-token", SECRET, "x")).toBe(false);
    expect(await verifySessionToken("", SECRET, "x")).toBe(false);
  });

  it("sets an HttpOnly, Secure, SameSite cookie", () => {
    const header = sessionCookieHeader("abc");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
  });
});

describe("isAdminRequest", () => {
  it("refuses a request with no credentials", async () => {
    const req = new Request("https://skrubbit.co.za/api/admin/products");
    expect(await isAdminRequest(req, { ...(await env()), ADMIN_SESSION_SECRET: SECRET })).toBe(
      false
    );
  });

  it("refuses an unverified Cloudflare Access header", async () => {
    const req = new Request("https://skrubbit.co.za/api/admin/products", {
      headers: { "cf-access-jwt-assertion": "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0." },
    });
    const e = { ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com", ACCESS_AUD: "aud" };
    expect(await isAdminRequest(req, e)).toBe(false);
  });

  it("accepts a valid session cookie", async () => {
    const e = { ...(await env()), ADMIN_SESSION_SECRET: SECRET };
    const token = await createSessionToken(SECRET, e.ADMIN_PASSWORD_HASH);
    const req = new Request("https://skrubbit.co.za/api/admin/products", {
      headers: { cookie: `skrubbit_admin=${encodeURIComponent(token)}` },
    });
    expect(await isAdminRequest(req, e)).toBe(true);
  });
});
