import type { MetadataRoute } from "next";

import { services } from "@/data/services";
import { getProductsSafe } from "@/lib/products";
import { absoluteUrl } from "@/lib/seo";

// Products live in D1, so the sitemap is built per request like the shop.
export const dynamic = "force-dynamic";

/**
 * Every public page a search engine should know about.
 *
 * A catalogue read failure drops the product URLs rather than failing the
 * sitemap: the rest of the site is still worth listing, and crawlers will pick
 * the products up again on their next visit.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProductsSafe();

  const pages: [string, number][] = [
    ["/", 1],
    ["/services", 0.9],
    ["/shop", 0.9],
    ["/capabilities", 0.7],
    ["/public-sector", 0.7],
    ["/about", 0.6],
    ["/contact", 0.6],
    ["/privacy", 0.1],
    ["/terms", 0.1],
    ["/cookies", 0.1],
  ];

  return [
    ...pages.map(([path, priority]) => ({ url: absoluteUrl(path), priority })),
    ...services.map((s) => ({
      url: absoluteUrl(`/services/${s.slug}`),
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/shop/${p.slug}`),
      priority: 0.7,
    })),
  ];
}
