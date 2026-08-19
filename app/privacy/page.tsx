import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/data/site";
import { getCompanyProfileSafe } from "@/lib/company";
import { LegalPage } from "@/components/legal-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Skrubb-it collects, uses and protects personal information, in line with the Protection of Personal Information Act.",
};

export default async function PrivacyPage() {
  const profile = await getCompanyProfileSafe();
  const company = profile.legalName || site.legalName;

  return (
    <LegalPage
      title="Privacy policy"
      intro={`How ${company} handles the personal information you give us, and what you can ask us to do with it.`}
      updated="19 August 2026"
    >
      <div className="space-y-3">
        <h2>Who we are</h2>
        <p>
          {company}
          {profile.registrationNumber
            ? `, registration number ${profile.registrationNumber},`
            : ""}{" "}
          is the responsible party for the personal information described here.
          Send any privacy question to{" "}
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>, or
          call {site.contact.phoneDisplay}.
        </p>
      </div>

      <div className="space-y-3">
        <h2>What we collect, and why</h2>
        <p>Only what you type into a form. Specifically:</p>
        <ul>
          <li>
            <strong>Enquiries.</strong> Your name, email address, phone number
            if you give one, and your message — so that we can reply.
          </li>
          <li>
            <strong>Orders.</strong> Your name, email address, phone number,
            delivery address and any note, plus the products and quantities you
            asked for — so that we can quote, confirm and deliver.
          </li>
        </ul>
        <p>
          We do not ask for identity numbers, and we never take card or banking
          details on this website. Nothing is charged online; an order placed
          here is a request that we confirm with you before anything is
          supplied or paid for.
        </p>
      </div>

      <div className="space-y-3">
        <h2>What we do not collect</h2>
        <p>
          There is no advertising, no analytics and no third-party tracking on
          this website. We do not build a profile of you, we do not sell or
          rent your information to anyone, and we do not send marketing you did
          not ask for. See our <Link href="/cookies">cookie policy</Link> for
          the detail.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Who else sees it</h2>
        <p>
          Only the service providers we need to run the business, and only for
          that purpose:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong> hosts the website and stores its data.
          </li>
          <li>
            <strong>Brevo</strong> delivers the emails we send you, such as an
            order confirmation.
          </li>
        </ul>
        <p>
          Both process information on our instruction. We will also disclose
          information where the law requires it.
        </p>
      </div>

      <div className="space-y-3">
        <h2>How long we keep it</h2>
        <p>
          Enquiries and orders are kept while we may still need them — to
          answer a follow-up question, honour a supply arrangement, or meet the
          record-keeping periods that tax and company law require. Ask us to
          delete something sooner and we will, unless we are obliged to keep it.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Your rights</h2>
        <p>Under the Protection of Personal Information Act you may:</p>
        <ul>
          <li>ask what personal information we hold about you;</li>
          <li>ask us to correct anything that is wrong;</li>
          <li>ask us to delete information we no longer need;</li>
          <li>object to how we are using it.</li>
        </ul>
        <p>
          Email <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>{" "}
          and we will respond. If you are not satisfied, you may complain to the
          Information Regulator of South Africa at{" "}
          <a
            href="https://inforegulator.org.za"
            target="_blank"
            rel="noopener noreferrer"
          >
            inforegulator.org.za
          </a>
          .
        </p>
      </div>

      <div className="space-y-3">
        <h2>Security</h2>
        <p>
          The website is served over HTTPS and the areas that hold customer
          information sit behind authentication. No system is perfect, so we
          keep what we collect to a minimum — the less we hold, the less there
          is to lose.
        </p>
      </div>
    </LegalPage>
  );
}
