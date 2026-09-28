import { site } from "@/data/site";

/**
 * Search-engine plumbing shared by the public pages.
 *
 * Structured data is built from data/site.ts rather than the company record in
 * D1: it is emitted by the root layout on every page, and a page must not lose
 * its business listing because the database was briefly unreachable.
 */

/** Absolute URL on the canonical host, for canonicals, sitemaps and JSON-LD. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, site.url).toString();
}

export const BUSINESS_ID = `${site.url}/#business`;

/** Where the business is, as search engines want it for local results. */
export const address = {
  "@type": "PostalAddress",
  addressLocality: "Khubvi",
  addressRegion: "Limpopo",
  addressCountry: "ZA",
} as const;

export const areaServed = [
  { "@type": "State", name: "Limpopo" },
  { "@type": "Country", name: "South Africa" },
];

export function businessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Organization"],
    "@id": BUSINESS_ID,
    name: site.name,
    legalName: site.legalName,
    alternateName: ["Skrubb it", "Skrubbit", "Skrubb-it Products"],
    description: site.description,
    url: site.url,
    logo: absoluteUrl("/images/brand/logo.png"),
    image: absoluteUrl("/images/brand/og.jpg"),
    telephone: site.contact.phoneDisplay.replace(/\s/g, ""),
    email: site.contact.email,
    address,
    areaServed,
    sameAs: [site.socials.facebook].filter(Boolean),
    knowsAbout: [
      "Cleaning chemicals",
      "Deep cleaning",
      "Industrial cleaning",
      "Office cleaning",
      "Sanitising and disinfection",
    ],
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
