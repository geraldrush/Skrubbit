import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/data/site";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "Skrubb-it uses no advertising or analytics cookies. What the site does store, and why.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      intro="Short, because there is very little to say."
      updated="19 August 2026"
    >
      <div className="space-y-3">
        <h2>We do not track you</h2>
        <p>
          This website carries no advertising cookies, no analytics, no
          social-media pixels and no third-party trackers of any kind. Nobody is
          measuring what you look at, and nothing about your visit is shared
          with an advertiser.
        </p>
        <p>
          That is why you are not being asked to accept anything. A consent
          banner exists to permit tracking, and there is none here to permit.
        </p>
      </div>

      <div className="space-y-3">
        <h2>What the site does store</h2>
        <ul>
          <li>
            <strong>Your shopping cart</strong> is kept in your own browser, so
            that it survives a page reload. It never reaches us until you send
            an order, and clearing your browser data removes it.
          </li>
          <li>
            <strong>One cookie for staff.</strong> Signing in to the private
            admin area sets a session cookie so the browser stays signed in. It
            is only ever set after a successful sign-in, and it is not set for
            anyone browsing the shop.
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2>Links to other sites</h2>
        <p>
          Following a link to WhatsApp or Facebook takes you onto their
          services, which have their own cookies and their own policies. What
          happens there is between you and them.
        </p>
      </div>

      <div className="space-y-3">
        <h2>Questions</h2>
        <p>
          Email <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
          . See also our <Link href="/privacy">privacy policy</Link>.
        </p>
      </div>
    </LegalPage>
  );
}
