import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { getCompanyProfile } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Credentials } from "@/components/credentials";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Government & institutional supply",
  description:
    "Skrubb-it is CSD-registered, tax compliant and a B-BBEE Level 1 contributor, supplying cleaning chemicals and consumables to schools, colleges, clinics and municipalities in Limpopo.",
};

/**
 * The page a supply chain officer needs.
 *
 * They are not browsing. They are checking whether a supplier can be quoted
 * against a commodity code and whether the compliance will survive evaluation.
 * Everything they need to answer that is on this page, and the numbers come
 * from the company record so they match the certificates.
 */
export default async function PublicSectorPage() {
  const profile = await getCompanyProfile();

  const steps = [
    {
      title: "Send us the RFQ or tender number",
      body: "Email the request, or the tender document, to the address below. Tell us the closing date and whether the quotation must be submitted on a specific form.",
    },
    {
      title: "We quote against your line items",
      body: "Priced per line, per pack size, with delivery included. Where a line falls outside what we can supply we say so rather than quoting to fill a page.",
    },
    {
      title: "Supporting documents with the quotation",
      body: "CSD report, B-BBEE affidavit, tax compliance status, company registration and material safety data sheets, supplied together so nothing holds the submission up.",
    },
    {
      title: "Delivery to site",
      body: "Delivered and offloaded at the campus, clinic or depot named in the order.",
    },
  ];

  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="container py-14 md:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            Government &amp; institutional supply
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            A compliant local supplier for schools, clinics and municipalities
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            We are registered on the Central Supplier Database, tax compliant and
            a B-BBEE Level 1 contributor. We manufacture in Vhembe and deliver
            across Limpopo, which keeps freight out of the price.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/contact">
                <FileText className="h-5 w-5" />
                Send us an RFQ
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/capabilities">What we supply</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b bg-background">
        <div className="container py-10">
          <Credentials profile={profile} />
        </div>
      </section>

      <section className="container py-14">
        <h2 className="font-display text-3xl font-extrabold">
          Supplier particulars
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Everything a supply chain officer needs to load us as a supplier or
          verify us on the CSD.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {[
                ["Registered name", profile.legalName],
                ["Company registration", profile.registrationNumber],
                ["CSD supplier number", profile.csdNumber],
                [
                  "VAT",
                  profile.vatRegistered
                    ? profile.vatNumber
                    : "Not registered for VAT — quotations are VAT-exclusive",
                ],
                ["B-BBEE status", profile.bbbeeStatus],
                ["Based in", "Khubvi, Vhembe District, Limpopo"],
                ["Telephone", profile.phone],
                ["Email", profile.email],
                [
                  "Tax, banking and certificates",
                  "Verifiable on the CSD, and supplied with every quotation",
                ],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <tr key={k}>
                    <th className="w-56 bg-secondary/40 px-4 py-3 text-left font-semibold">
                      {k}
                    </th>
                    <td className="px-4 py-3 text-muted-foreground">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t bg-secondary/40 py-14">
        <div className="container">
          <h2 className="font-display text-3xl font-extrabold">
            How a quotation works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent font-display text-lg font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold">{s.title}</h3>
                  <p className="mt-1 text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container py-14">
        <div className="rounded-xl border bg-background p-8">
          <h2 className="font-display text-2xl font-extrabold">
            What we are honest about
          </h2>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            We are an Exempted Micro Enterprise and we describe ourselves as one.
            Production is owner-run, with staff engaged as the size of an order
            requires. That suits contracts calling for regular, moderate volumes
            delivered reliably and close to hand. Where a requirement is beyond
            what we can produce in the time allowed, we will tell you at
            quotation stage rather than accept an order we cannot fill.
          </p>
        </div>
      </section>
    </>
  );
}
