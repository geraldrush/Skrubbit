import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { site } from "@/data/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartSheet } from "@/components/cart-sheet";
import { Toaster } from "@/components/ui/sonner";
import { JsonLd } from "@/components/json-ld";
import { businessSchema } from "@/lib/seo";

const defaultTitle =
  "Skrubb-it | Cleaning Products & Professional Cleaning Services in Limpopo";

/*
 * Nunito and Baloo 2, served from this repo rather than fetched from Google
 * Fonts during the build.
 *
 * `next/font/google` downloads the files at build time, which made every
 * deploy depend on fonts.googleapis.com answering quickly. It stopped doing so
 * — Baloo 2 timed out three builds in a row and no deploy could go out.
 *
 * These are the same latin-subset variable files Google was serving, so the
 * rendering is unchanged. Both faces are SIL Open Font Licensed, which permits
 * redistribution like this. It also drops a third-party request from every
 * page load: visitors no longer fetch from fonts.gstatic.com.
 */
const nunito = localFont({
  src: "./fonts/nunito.woff2",
  variable: "--font-nunito",
  display: "swap",
  // The variable file carries the whole axis; naming the range lets the
  // browser synthesise nothing and pick real weights.
  weight: "200 1000",
});

const baloo = localFont({
  src: "./fonts/baloo2.woff2",
  variable: "--font-baloo",
  display: "swap",
  weight: "400 800",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: defaultTitle,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    title: defaultTitle,
    description: site.description,
    url: site.url,
    siteName: site.legalName,
    locale: "en_ZA",
    type: "website",
    images: [
      {
        url: "/images/brand/og.jpg",
        width: 1200,
        height: 630,
        alt: "The Skrubb-it range of cleaning products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: site.description,
    images: ["/images/brand/og.jpg"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/images/brand/logo-small.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFCC00",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA" className={`${nunito.variable} ${baloo.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <JsonLd data={businessSchema()} />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartSheet />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
