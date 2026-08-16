import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, Download } from "lucide-react";

import { formatZAR } from "@/lib/utils";
import { getCompanyProfile, missingProfileFields } from "@/lib/company";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatDateTime,
  getPricing,
  getTender,
  listDocuments,
  priceTotals,
  sastToday,
  VAT_RATE,
  type ItemCategory,
  type TenderItem,
} from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tender pack",
  robots: { index: false, follow: false },
};

/**
 * The printable tender pack.
 *
 * Generates only the documents we author — cover letter, contents, company
 * profile, pricing schedule and divider sheets. It deliberately does NOT
 * generate SBD 1/4/6.1/8/9: those are official National Treasury forms that
 * arrive in the tender pack and must be completed and signed on the originals.
 * A self-produced lookalike would be non-compliant, so the pack lists them as
 * items to insert instead.
 */

/** "16 August 2026" — the long form a letter should carry. */
function longDate(today: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const [y, m, d] = today.split("-");
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

function Sheet({ children }: { children: React.ReactNode }) {
  return <section className="pack-sheet">{children}</section>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{value || "—"}</td>
    </tr>
  );
}

export default async function PackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await adminGate();
  if (gate) return gate;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [loaded, profile, documents, pricing] = await Promise.all([
    getTender(id),
    getCompanyProfile(),
    listDocuments(),
    getPricing(id),
  ]);
  if (!loaded) notFound();

  const { tender, items } = loaded;
  const totals = priceTotals(pricing);
  // What the buyer actually pays. VAT is only added when we are registered to
  // charge it — quoting VAT otherwise is an unlawful charge, not a rounding
  // detail, and can invalidate the bid.
  const payable = profile.vatRegistered ? totals.incl : totals.excl;
  const today = sastToday();
  const missing = missingProfileFields(profile);
  const enclosures = documents.filter((d) => d.fileKey);

  const csd = documents.find((d) => d.kind === "csd_report");
  const bbbee = documents.find((d) => d.kind === "bbbee");
  const taxPin = documents.find((d) => d.kind === "tax_pin");

  const included = items.filter((i) => i.required);
  const byCategory = new Map<ItemCategory, TenderItem[]>();
  for (const item of included) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const categories = CATEGORY_ORDER.filter((c) => byCategory.has(c));

  const company = profile.legalName || "[Registered company name]";

  return (
    <>
      {/* Print rules live with the document they format. A4 with a proper
          margin, one section per page, and the app chrome dropped entirely so
          the printed pages carry only the bid. */}
      <style>{`
        .pack-sheet { break-after: page; page-break-after: always; }
        .pack-sheet:last-child { break-after: auto; page-break-after: auto; }
        .pack table { width: 100%; border-collapse: collapse; }
        .pack th, .pack td { text-align: left; vertical-align: top; padding: 6px 8px; }
        .pack .grid-table th, .pack .grid-table td { border: 1px solid #999; }
        .pack .grid-table thead th { background: #f0f0ee; }
        .pack .num { text-align: right; font-variant-numeric: tabular-nums; }
        @media print {
          @page { size: A4; margin: 18mm; }
          html, body { background: #fff !important; }
          .no-print, header, footer, nav { display: none !important; }
          .pack { color: #000; font-size: 11pt; }
          .pack a { color: #000; text-decoration: none; }
          .pack .grid-table thead { display: table-header-group; }
          .pack tr, .pack li { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="container max-w-4xl py-8">
        {/* Screen-only controls and warnings. */}
        <div className="no-print mb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/admin/tenders/${tender.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
            >
              <ChevronLeft className="h-4 w-4" /> Back to tender
            </Link>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/admin/tenders/${tender.id}/pack.pdf`}
                className="inline-flex h-10 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
              >
                <Download className="mr-2 h-4 w-4" /> Download full PDF
              </a>
              {enclosures.length ? (
                <a
                  href="/api/admin/documents/enclosures.zip"
                  className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary"
                >
                  <Download className="mr-2 h-4 w-4" /> Enclosures ({enclosures.length})
                </a>
              ) : null}
              <a
                href={`/api/admin/tenders/${tender.id}/pricing.csv`}
                className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-secondary"
              >
                <Download className="mr-2 h-4 w-4" /> Pricing CSV
              </a>
              <PrintButton />
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-[#8a5a00] dark:text-[#fab219]">
              <AlertTriangle className="h-4 w-4" />
              This pack does not include the SBD forms
            </p>
            <p className="mt-1 text-muted-foreground">
              SBD 1, 4, 6.1, 8 and 9 are official National Treasury forms that
              come with the tender document. Complete and sign the originals and
              insert them behind the matching divider — a reproduced copy is not
              compliant. Everything here still has to be signed by hand.
            </p>
          </div>

          {missing.length ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-semibold text-destructive">
                Missing company details — these print as placeholders
              </p>
              <ul className="ml-5 mt-1 list-disc">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <Link href="/admin/documents" className="mt-2 inline-block font-medium underline">
                Fill them in →
              </Link>
            </div>
          ) : null}

          {documents.length && enclosures.length < documents.length ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold text-[#8a5a00] dark:text-[#fab219]">
                <AlertTriangle className="h-4 w-4" />
                {documents.length - enclosures.length} of {documents.length}{" "}
                documents have no file uploaded
              </p>
              <p className="mt-1 text-muted-foreground">
                They appear on the enclosure schedule, but there is nothing to
                print for them.{" "}
                <Link href="/admin/documents" className="font-medium underline">
                  Upload the certificates
                </Link>
                .
              </p>
            </div>
          ) : null}

          {!pricing.length ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-semibold text-destructive">
                No pricing lines — the schedule will print empty
              </p>
              <Link
                href={`/admin/tenders/${tender.id}`}
                className="mt-1 inline-block font-medium underline"
              >
                Add pricing on the tender page →
              </Link>
            </div>
          ) : null}
        </div>

        <div className="pack space-y-12">
          {/* ------------------------------ cover letter ---------------- */}
          <Sheet>
            <div className="mb-8 border-b-2 pb-4">
              <h1 className="text-2xl font-bold">{company}</h1>
              {profile.tradingName ? (
                <p className="text-sm">Trading as {profile.tradingName}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-line text-sm">
                {profile.physicalAddress || "[Physical address]"}
              </p>
              <p className="text-sm">
                {[profile.phone, profile.email, profile.website]
                  .filter(Boolean)
                  .join(" · ") || "[Contact details]"}
              </p>
              <p className="mt-1 text-sm">
                Reg. no: {profile.registrationNumber || "[Registration number]"}
                {profile.vatNumber ? ` · VAT no: ${profile.vatNumber}` : ""}
              </p>
            </div>

            <p className="mb-6 text-sm">{longDate(today)}</p>

            <p className="mb-1 text-sm font-semibold">
              {tender.department || "[Issuing department]"}
            </p>
            <p className="mb-6 text-sm">Attention: Supply Chain Management</p>

            <p className="mb-4 font-bold">
              RE: {tender.reference} — {tender.title}
            </p>

            <div className="space-y-3 text-sm leading-relaxed">
              <p>Dear Sir / Madam,</p>
              <p>
                {company} hereby submits its bid in response to the above tender.
                We confirm that we have read and understood the tender document,
                the conditions of bid and the specifications, and that our offer
                is made in full compliance with them.
              </p>
              <p>
                We are registered on the Central Supplier Database
                {csd?.reference ? ` under supplier number ${csd.reference}` : ""} and
                our tax affairs are in order with the South African Revenue
                Service. {bbbee?.bbbeeLevel
                  ? `We are a Level ${bbbee.bbbeeLevel} B-BBEE contributor, and the supporting certificate is enclosed.`
                  : ""}
              </p>
              <p>
                {/* Punctuation kept inside the expression: a newline between
                    JSX expressions renders as a space, which would print
                    "including VAT ." with a gap before the full stop. */}
                {totals.incl > 0
                  ? `Our pricing is set out in the enclosed pricing schedule and is ${formatZAR(payable)}${profile.vatRegistered ? " including VAT" : ". We are not registered for VAT"}.`
                  : "Our pricing is set out in the enclosed pricing schedule [pricing to be completed]."}{" "}
                This offer is valid for the period stipulated in the tender
                document, and we confirm our capacity to supply and deliver
                within the required timeframes.
              </p>
              <p>
                All mandatory returnable documents are enclosed and indexed in
                the contents page that follows. We trust our submission is
                favourably received and remain available for any clarification.
              </p>
              <p>Yours faithfully,</p>
            </div>

            <div className="mt-10">
              <div className="h-12 w-72 border-b border-black" />
              <p className="mt-1 text-sm font-semibold">
                {profile.signatoryName || "[Name of signatory]"}
              </p>
              <p className="text-sm">
                {`${profile.signatoryPosition || "[Capacity]"}, duly authorised on behalf of ${company}`}
              </p>
              <p className="mt-4 text-xs italic">
                This letter must be signed by hand before submission.
              </p>
            </div>
          </Sheet>

          {/* -------------------------------- contents ------------------ */}
          <Sheet>
            <h2 className="mb-1 text-xl font-bold">Table of contents</h2>
            <p className="mb-6 text-sm">
              {tender.reference} — {tender.title}
              <br />
              Closing: {formatDateTime(tender.closingAt)}
            </p>

            <table className="grid-table text-sm">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>Tab</th>
                  <th>Document</th>
                  <th style={{ width: "18%" }}>Included</th>
                </tr>
              </thead>
              <tbody>
                {categories.flatMap((category, ci) => [
                  <tr key={`h-${category}`}>
                    <th colSpan={3} style={{ background: "#f0f0ee" }}>
                      {String.fromCharCode(65 + ci)} — {CATEGORY_LABELS[category]}
                    </th>
                  </tr>,
                  ...(byCategory.get(category) ?? []).map((item, ii) => (
                    <tr key={item.id}>
                      <td>
                        {String.fromCharCode(65 + ci)}
                        {ii + 1}
                      </td>
                      <td>
                        {item.label}
                        {item.signatureRequired ? (
                          <strong> (signature required)</strong>
                        ) : null}
                      </td>
                      <td>{item.attached ? "☑" : "☐"}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </Sheet>

          {/* ---------------------------- company profile --------------- */}
          <Sheet>
            <h2 className="mb-4 text-xl font-bold">Company profile</h2>

            <table className="grid-table mb-6 text-sm">
              <tbody>
                <Field label="Registered name" value={profile.legalName} />
                <Field label="Trading name" value={profile.tradingName} />
                <Field label="Registration number" value={profile.registrationNumber} />
                <Field label="VAT number" value={profile.vatNumber} />
                <Field label="CSD supplier number" value={csd?.reference ?? ""} />
                <Field
                  label="B-BBEE level"
                  value={bbbee?.bbbeeLevel ? `Level ${bbbee.bbbeeLevel}` : ""}
                />
                <Field
                  label="Tax compliance"
                  value={
                    taxPin?.expiresOn
                      ? `PIN valid to ${taxPin.expiresOn}`
                      : taxPin
                        ? "PIN on file"
                        : ""
                  }
                />
                <Field label="Physical address" value={profile.physicalAddress} />
                <Field label="Postal address" value={profile.postalAddress} />
                <Field label="Telephone" value={profile.phone} />
                <Field label="Email" value={profile.email} />
                <Field
                  label="Contact person"
                  value={
                    [profile.signatoryName, profile.signatoryPosition]
                      .filter(Boolean)
                      .join(", ")
                  }
                />
              </tbody>
            </table>

            {profile.profileText ? (
              <div className="whitespace-pre-line text-sm leading-relaxed">
                {profile.profileText}
              </div>
            ) : (
              <p className="text-sm italic">
                [Company profile not yet written — add it under Documents.]
              </p>
            )}
          </Sheet>

          {/* --------------------------- enclosure schedule ------------- */}
          <Sheet>
            <h2 className="mb-1 text-xl font-bold">Schedule of enclosed documents</h2>
            <p className="mb-6 text-sm">
              Company documents submitted with this bid, with their reference
              numbers and validity.
            </p>

            <table className="grid-table text-sm">
              <thead>
                <tr>
                  <th style={{ width: "6%" }}>No.</th>
                  <th>Document</th>
                  <th style={{ width: "24%" }}>Reference</th>
                  <th style={{ width: "18%" }}>Valid until</th>
                </tr>
              </thead>
              <tbody>
                {documents.length ? (
                  documents.map((doc, i) => (
                    <tr key={doc.id}>
                      <td>{i + 1}</td>
                      <td>
                        {doc.label}
                        {doc.bbbeeLevel ? ` — Level ${doc.bbbeeLevel}` : ""}
                      </td>
                      <td>{doc.reference || "—"}</td>
                      <td>{doc.expiresOn ?? "Does not expire"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="italic">
                      [No company documents recorded.]
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <p className="mt-6 text-xs italic">
              Certified copies of the documents listed above are enclosed behind
              the relevant dividers.
            </p>
          </Sheet>

          {/* ---------------------------- pricing schedule -------------- */}
          <Sheet>
            <h2 className="mb-1 text-xl font-bold">Pricing schedule</h2>
            <p className="mb-6 text-sm">
              {tender.reference} — {tender.title}
              <br />
              All amounts in South African Rand.{" "}
              {profile.vatRegistered
                ? `VAT at ${(VAT_RATE * 100).toFixed(0)}%.`
                : "Not registered for VAT — no VAT is charged."}
            </p>

            <table className="grid-table text-sm">
              <thead>
                <tr>
                  <th style={{ width: "6%" }}>Item</th>
                  <th>Description</th>
                  <th style={{ width: "12%" }}>Unit</th>
                  <th style={{ width: "10%" }} className="num">Qty</th>
                  <th style={{ width: "16%" }} className="num">Unit price</th>
                  <th style={{ width: "16%" }} className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pricing.length ? (
                  pricing.map((line, i) => (
                    <tr key={line.id}>
                      <td>{i + 1}</td>
                      <td>{line.description}</td>
                      <td>{line.unit}</td>
                      <td className="num">{line.quantity}</td>
                      <td className="num">{formatZAR(line.unitPrice)}</td>
                      <td className="num">
                        {formatZAR(line.quantity * line.unitPrice)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="italic">
                      [No pricing lines captured.]
                    </td>
                  </tr>
                )}
                {profile.vatRegistered ? (
                  <>
                    <tr>
                      <td colSpan={5} className="num">
                        <strong>Subtotal (excl VAT)</strong>
                      </td>
                      <td className="num">
                        <strong>{formatZAR(totals.excl)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="num">
                        VAT @ {(VAT_RATE * 100).toFixed(0)}%
                      </td>
                      <td className="num">{formatZAR(totals.vat)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="num">
                        <strong>Total (incl VAT)</strong>
                      </td>
                      <td className="num">
                        <strong>{formatZAR(totals.incl)}</strong>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={5} className="num">
                      <strong>Total (no VAT — not VAT registered)</strong>
                    </td>
                    <td className="num">
                      <strong>{formatZAR(totals.excl)}</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-10">
              <div className="h-12 w-72 border-b border-black" />
              <p className="mt-1 text-sm">
                {profile.signatoryName || "[Name]"} —{" "}
                {profile.signatoryPosition || "[Capacity]"}
              </p>
              <p className="mt-3 text-xs italic">
                Transfer these amounts onto the official SBD 3.1 / 3.2 / 3.3
                pricing form supplied with the tender, and sign it. This schedule
                supports that form; it does not replace it.
              </p>
            </div>
          </Sheet>

          {/* ------------------------------ dividers -------------------- */}
          {categories.map((category, ci) => (
            <Sheet key={`divider-${category}`}>
              <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                <p className="text-6xl font-black">
                  {String.fromCharCode(65 + ci)}
                </p>
                <h2 className="mt-4 text-3xl font-bold">
                  {CATEGORY_LABELS[category]}
                </h2>
                <ul className="mt-6 space-y-1 text-sm">
                  {(byCategory.get(category) ?? []).map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            </Sheet>
          ))}
        </div>
      </div>
    </>
  );
}
