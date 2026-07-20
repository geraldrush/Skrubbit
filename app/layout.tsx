import type { Metadata, Viewport } from "next";
import { Nunito, Baloo_2 } from "next/font/google";
import "./globals.css";

import { site } from "@/data/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartSheet } from "@/components/cart-sheet";
import { Toaster } from "@/components/ui/sonner";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.legalName} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.legalName} — ${site.tagline}`,
    description: site.description,
    url: site.url,
    siteName: site.legalName,
    locale: "en_ZA",
    type: "website",
  },
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
    <html lang="en" className={`${nunito.variable} ${baloo.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartSheet />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
