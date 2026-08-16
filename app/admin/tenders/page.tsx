import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

import {
  assessTender,
  formatDateTime,
  itemsByTender,
  listDocuments,
  listTenders,
  summarise,
} from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { TenderForm } from "@/components/admin/tender-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tenders",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  preparing: "Preparing",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};

export default async function TendersPage() {
  const gate = await adminGate();
  if (gate) return gate;

  const [tenders, items, documents] = await Promise.all([
    listTenders(),
    itemsByTender(),
    listDocuments(),
  ]);

  const now = new Date();
  const rows = tenders.map((tender) => ({
    tender,
    readiness: summarise(
      assessTender(tender, items.get(tender.id) ?? [], documents, now)
    ),
  }));

  const open = rows.filter((r) => r.tender.status === "preparing");

  return (
    <div className="container max-w-4xl py-10">
      <AdminNav
        current="/admin/tenders"
        title="Tenders"
        description="Every bid in progress, with what still stands between it and a compliant submission."
      />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Register ({tenders.length}
          {open.length !== tenders.length ? `, ${open.length} in progress` : ""})
        </h2>

        {rows.length ? (
          <ul className="divide-y rounded-lg border">
            {rows.map(({ tender, readiness }) => (
              <li key={tender.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/tenders/${tender.id}`}
                      className="font-semibold hover:text-accent"
                    >
                      {tender.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {tender.reference}
                      {tender.department ? ` · ${tender.department}` : ""} ·{" "}
                      {STATUS_LABELS[tender.status] ?? tender.status}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="inline-flex items-center gap-1.5 font-medium">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDateTime(tender.closingAt)}
                    </p>
                    {readiness.ready ? (
                      <p className="inline-flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {readiness.warnings
                          ? `${readiness.warnings} to check`
                          : "Ready"}
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-1.5 text-destructive">
                        <XCircle className="h-3.5 w-3.5" />
                        {readiness.blockers}{" "}
                        {readiness.blockers === 1 ? "blocker" : "blockers"}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No tenders yet. Add one below and its compliance matrix is created
            from the mandatory checklist.
          </p>
        )}
      </section>

      {!documents.length ? (
        <p className="mb-10 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-500" />
          <span>
            No company documents are recorded yet, so certificate expiry can&apos;t
            be checked against any tender.{" "}
            <Link href="/admin/documents" className="font-medium underline">
              Add them
            </Link>
            .
          </span>
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Add a tender</h2>
        <TenderForm />
      </section>
    </div>
  );
}
