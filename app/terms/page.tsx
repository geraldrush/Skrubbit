import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/data/site";
import { getCompanyProfileSafe } from "@/lib/company";
import { LegalPage } from "@/components/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms on which Skrubb-it quotes, supplies and delivers cleaning chemicals and consumables.",
};

export default async function TermsPage() {
  const profile = await getCompanyProfileSafe();
  const company = profile.legalName || site.legalName;

  return (
    <LegalPage
      title="Terms of service"
      intro={`The terms on which ${company} quotes for and supplies goods ordered through this website.`}
      updated="19 August 2026"
    >
      <div className="space-y-3">
        <h2>Who you are dealing with</h2>
        <ul>
          <li>{company}</li>
          {profile.registrationNumber && (
            <li>Registration number {profile.registrationNumber}</li>
          )}
          <li>Khubvi, Vhembe District, Limpopo, South Africa</li>
          <li>
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a> ·{" "}
            {site.contact.phoneDisplay}
          </li>
          {!profile.vatRegistered && (
            <li>Not registered for VAT — no VAT is charged on our prices</li>
          )}
        </ul>
      </div>

      <div className="space-y-3">
        <h2>An order here is a request, not a sale</h2>
        <p>
          Sending an order through this website does not conclude a contract. It
          tells us what you need. We then confirm availability, delivery and the
          final price with you, and a sale comes into existence only when we
          accept your order in writing. Nothing is charged before that, and this
          website never takes card or banking details.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Prices</h2>
        <p>
          Prices shown are in South African rand and exclude delivery. They are
          a guide for ordinary quantities and may change — raw material costs
          move, and a bulk or contract order is quoted on its own terms. The
          price that applies is the one in the quotation we send you.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Delivery</h2>
        <p>
          We deliver throughout Limpopo, and to other provinces by arrangement.
          Delivery times are estimates given in good faith; where a requirement
          exceeds what we can produce in the time available we will say so when
          we quote rather than accept an order we cannot fill.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Using the products safely</h2>
        <p>
          These are cleaning chemicals. Use them for their stated purpose, at
          the stated dilution, keep them in their original labelled containers
          and out of reach of children, and never mix them with other products —
          in particular, never mix a bleach with an acidic cleaner. A safety
          data sheet is available for anything we manufacture; ask and we will
          send it.
        </p>
        <p>
          We do not market any product as a disinfectant, sanitiser or as
          killing a stated percentage of germs unless it has been through the
          applicable South African regulatory and efficacy route.
        </p>
      </div>

      <div className="space-y-3">
        <h2>If something is wrong with an order</h2>
        <p>
          Tell us. If goods are defective, not what was ordered, or damaged on
          arrival, contact us within seven days of delivery and we will replace
          them or refund you. Your rights under the Consumer Protection Act are
          not limited by anything on this page.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Liability</h2>
        <p>
          We stand behind what we supply. We are not liable for loss caused by
          using a product contrary to its instructions, for a use it was not
          intended for, or after it has been decanted, diluted or mixed by
          someone else.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Governing law</h2>
        <p>
          These terms are governed by the law of the Republic of South Africa.
          See also our <Link href="/privacy">privacy policy</Link> and{" "}
          <Link href="/cookies">cookie policy</Link>.
        </p>
      </div>
    </LegalPage>
  );
}
