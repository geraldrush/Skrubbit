import { BadgeCheck, Building2, FileCheck2, MapPin, ShieldCheck } from "lucide-react";

import type { CompanyProfile } from "@/lib/company";

/**
 * The credentials a professional buyer looks for before anything else.
 *
 * A government or institutional buyer checks compliance before they read a
 * price: are you on the CSD, what is your B-BBEE level, are you tax compliant,
 * are you a real registered company. Putting that on the page rather than
 * leaving it to a PDF attachment is the difference between a shop and a
 * supplier.
 *
 * Everything here comes from the company record in /admin, so a certificate
 * that is renewed is corrected in one place.
 */
export function Credentials({
  profile,
  className = "",
}: {
  profile: CompanyProfile;
  className?: string;
}) {
  const level = /level\s*\d/i.exec(profile.bbbeeStatus)?.[0];
  const recognition = /\d+%\s*procurement recognition/i.exec(profile.bbbeeStatus)?.[0];

  const items = [
    level && {
      icon: ShieldCheck,
      label: `B-BBEE ${level}`,
      detail: recognition ?? "Exempted Micro Enterprise",
    },
    profile.csdNumber && {
      icon: FileCheck2,
      label: "CSD registered",
      detail: profile.csdNumber,
    },
    profile.registrationNumber && {
      icon: Building2,
      label: "Registered company",
      detail: profile.registrationNumber,
    },
    {
      icon: BadgeCheck,
      label: "Tax compliant",
      detail: "SARS status verified on the CSD",
    },
    {
      icon: MapPin,
      label: "Vhembe, Limpopo",
      detail: "Local delivery, no Gauteng freight",
    },
  ].filter(Boolean) as Array<{
    icon: typeof ShieldCheck;
    label: string;
    detail: string;
  }>;

  return (
    <dl
      className={`grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {items.map(({ icon: Icon, label, detail }) => (
        <div key={label} className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <dt className="font-semibold leading-tight">{label}</dt>
            <dd className="text-sm text-muted-foreground">{detail}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
