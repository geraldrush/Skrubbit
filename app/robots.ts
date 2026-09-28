import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * The workers.dev copy of the site is kept out of search separately, by an
 * X-Robots-Tag header in middleware.ts; this file is only served meaningfully
 * on the real domain.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/checkout"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
