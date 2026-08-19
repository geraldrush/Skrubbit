import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";

import { site } from "@/data/site";
import { getCompanyProfile } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Credentials } from "@/components/credentials";
import { ProfileProse } from "@/components/profile-prose";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About the company",
  description:
    "Skrubb-it is a registered, CSD-listed, B-BBEE Level 1 manufacturer of cleaning chemicals and hygiene consumables, based in the Vhembe District of Limpopo.",
};

/**
 * The company, not the catalogue.
 *
 * Written from the company record in /admin rather than hard-coded, so this
 * page, the downloadable profile and the tender pack all say the same thing.
 * A buyer deciding whether to trust a supplier reads this page; the shop is
 * where they go once they have.
 */
export default async function AboutPage() {
  const profile = await getCompanyProfile();

  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="container py-14 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            About the company
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {profile.legalName || site.legalName}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            A registered South African manufacturer of cleaning chemicals and
            hygiene consumables, supplying households, businesses and the public
            sector from the Vhembe District of Limpopo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/public-sector">
                <ShieldCheck className="h-5 w-5" />
                For government &amp; institutions
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">
                <FileText className="h-5 w-5" />
                Request our company profile
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b bg-background">
        <div className="container py-10">
          <Credentials profile={profile} />
        </div>
      </section>

      <section className="container py-14 md:py-20">
        {profile.profileText ? (
          <ProfileProse text={profile.profileText} />
        ) : (
          <p className="text-muted-foreground">
            The company profile has not been written yet.
          </p>
        )}
      </section>

      <section className="border-t bg-secondary/40">
        <div className="container flex flex-col items-start gap-4 py-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold">
              Need a quotation?
            </h2>
            <p className="mt-1 max-w-xl text-muted-foreground">
              Tell us what you need and in what quantity. Bulk and contract
              pricing is quoted per order.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/contact">
                <FileText className="h-5 w-5" />
                Request a quotation
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/capabilities">What we supply</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
