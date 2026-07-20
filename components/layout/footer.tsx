import Link from "next/link";
import { Mail, MapPin, Phone, Facebook } from "lucide-react";

import { site } from "@/data/site";
import { categories } from "@/data/products";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-secondary/50">
      <div className="container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            {site.description}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Proudly South African
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">
            Shop
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/shop?category=${c.id}`}
                  className="transition-colors hover:text-accent"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">
            Company
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/about" className="hover:text-accent">
                About us
              </Link>
            </li>
            <li>
              <Link href="/shop" className="hover:text-accent">
                All products
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-accent">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide">
            Get in touch
          </h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{site.contact.location}</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <a href={`tel:${site.contact.whatsapp}`} className="hover:text-accent">
                {site.contact.phoneDisplay}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <a
                href={`mailto:${site.contact.email}`}
                className="hover:text-accent"
              >
                {site.contact.email}
              </a>
            </li>
            {site.socials.facebook && (
              <li className="flex items-start gap-2">
                <Facebook className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <a
                  href={site.socials.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent"
                >
                  Facebook
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.legalName}. All rights reserved.
          </p>
          <p>Made in South Africa 🇿🇦</p>
        </div>
      </div>
    </footer>
  );
}
