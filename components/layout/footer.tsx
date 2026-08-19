import Link from "next/link";
import { Facebook } from "lucide-react";

import { site } from "@/data/site";
import { getCompanyProfileSafe } from "@/lib/company";
import { Logo } from "@/components/logo";

/**
 * Centred and deliberately short.
 *
 * A footer earns its height by being useful, not by listing every category
 * twice. One centred stack — mark, one line of what the company is, the links
 * people actually follow, how to reach us — then a hairline and the
 * registration particulars a professional buyer looks for before taking a
 * supplier seriously.
 *
 * The particulars come from the company record, so they cannot drift out of
 * step with the profile or the certificates.
 */
export async function Footer() {
  const profile = await getCompanyProfileSafe();
  const level = /Level\s*\d/i.exec(profile.bbbeeStatus)?.[0];

  const links = [
    { href: "/shop", label: "Shop" },
    { href: "/capabilities", label: "What we supply" },
    { href: "/public-sector", label: "Government" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const particulars = [
    profile.registrationNumber && `Reg. ${profile.registrationNumber}`,
    profile.csdNumber && `CSD ${profile.csdNumber}`,
    level && `B-BBEE ${level}`,
    profile.vatRegistered ? `VAT ${profile.vatNumber}` : "Not VAT registered",
  ].filter(Boolean) as string[];

  return (
    <footer className="mt-16 border-t bg-secondary/40">
      <div className="container flex flex-col items-center gap-4 py-9 text-center">
        <Logo />

        <p className="text-sm text-muted-foreground">
          Cleaning chemicals and hygiene consumables, manufactured in{" "}
          {site.contact.location}.
        </p>

        <nav
          aria-label="Footer"
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground transition-colors hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <address className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm not-italic text-muted-foreground">
          <a
            href={`tel:${site.contact.whatsapp}`}
            className="transition-colors hover:text-accent"
          >
            {site.contact.phoneDisplay}
          </a>
          <a
            href={`mailto:${site.contact.email}`}
            className="transition-colors hover:text-accent"
          >
            {site.contact.email}
          </a>
          {site.socials.facebook && (
            <a
              href={site.socials.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="transition-colors hover:text-accent"
            >
              <Facebook className="h-5 w-5" />
            </a>
          )}
        </address>
      </div>

      <div className="border-t">
        <div className="container flex flex-col items-center gap-2 py-4 text-center text-xs text-muted-foreground">
          <nav
            aria-label="Legal"
            className="flex flex-wrap justify-center gap-x-4 gap-y-1"
          >
            <Link href="/privacy" className="transition-colors hover:text-accent">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-accent">
              Terms of service
            </Link>
            <Link href="/cookies" className="transition-colors hover:text-accent">
              Cookies
            </Link>
          </nav>
          {particulars.length > 0 && (
            <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              {particulars.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </p>
          )}
          <p>
            © {new Date().getFullYear()} {profile.legalName || site.legalName}.
            All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
