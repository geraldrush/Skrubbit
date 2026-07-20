/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Product/label art is already sized for the web; skip the optimizer so it
    // works identically on `next dev` and on Cloudflare Workers.
    unoptimized: true,
  },
};

export default nextConfig;

// Enable Cloudflare bindings (D1, R2, KV, env) during `next dev`.
// This is a no-op in the browser and only runs in the Node dev server.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
