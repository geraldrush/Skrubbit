/**
 * Content Security Policy.
 *
 * Everything the site loads comes from its own origin, with two exceptions:
 * Cloudflare Turnstile (script and challenge iframe, on the public forms and
 * the admin sign-in) and Cloudflare Web Analytics, should it be switched on
 * in the dashboard. Product images are served from R2 through /img on the same
 * origin. 'unsafe-inline' is needed for scripts because Next.js inlines its
 * bootstrap without a nonce on statically rendered pages; it is the trade-off
 * for keeping those pages static and served from the edge cache.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Two years. Subdomains are left out on purpose: mail and other DNS records
  // on skrubbit.co.za are not ours to force onto HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework version to anyone probing for weaknesses.
  poweredByHeader: false,
  images: {
    // Product/label art is already sized for the web; skip the optimizer so it
    // works identically on `next dev` and on Cloudflare Workers.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// Enable Cloudflare bindings (D1, R2, KV, env) during `next dev`.
// This is a no-op in the browser and only runs in the Node dev server.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
