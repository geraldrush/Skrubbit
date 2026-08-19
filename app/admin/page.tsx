import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FolderLock,
  Search,
  XCircle,
} from "lucide-react";

import { OVERDUE_HOURS, lastRun } from "@/lib/cron-runs";
import { getProducts } from "@/lib/products";
import { getRecentContactMessages, getRecentOrders } from "@/lib/enquiries";
import {
  assessTender,
  itemsByTender,
  listDocuments,
  listTenders,
  matrixProgress,
  sastToday,
  summarise,
} from "@/lib/tenders";
import { adminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  Compliance,
  Deadlines,
  DocumentStatus,
  Panel,
  RunStatus,
  ShopSummary,
  StatTile,
  type ComplianceRow,
  type DeadlineRow,
  type DocRow,
} from "@/components/admin/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 864e5);
}

/** Expiry state relative to today, matching the document register's badges. */
function expiryState(expiresOn: string | null, today: string): DocRow["state"] {
  if (!expiresOn) return "none";
  if (expiresOn < today) return "expired";
  const soon = new Date(`${today}T12:00:00+02:00`);
  soon.setDate(soon.getDate() + 30);
  return new Date(`${expiresOn}T12:00:00+02:00`) <= soon ? "expiring" : "valid";
}

export default async function DashboardPage() {
  // Guard runs before any query, so nothing is loaded for anonymous visitors.
  const gate = await adminGate();
  if (gate) return gate;

  const [tenders, items, documents, orders, messages, products, run] =
    await Promise.all([
      listTenders(),
      itemsByTender(),
      listDocuments(),
      getRecentOrders(),
      getRecentContactMessages(),
      getProducts(),
      lastRun(),
    ]);

  const now = new Date();
  const today = sastToday(now);

  const open = tenders.filter((t) => t.status === "preparing");
  const assessed = open.map((tender) => {
    const tenderItems = items.get(tender.id) ?? [];
    return {
      tender,
      readiness: summarise(assessTender(tender, tenderItems, documents, now)),
      progress: matrixProgress(tenderItems),
      daysLeft: daysUntil(tender.closingAt, now),
    };
  });

  const ready = assessed.filter((a) => a.readiness.ready).length;
  const blocked = assessed.length - ready;
  const closingThisWeek = assessed.filter(
    (a) => a.daysLeft >= 0 && a.daysLeft <= 7
  ).length;

  const docRows: DocRow[] = documents.map((d) => ({
    id: d.id,
    label: d.label,
    expiresOn: d.expiresOn,
    state: expiryState(d.expiresOn, today),
  }));
  const expired = docRows.filter((d) => d.state === "expired").length;
  const expiring = docRows.filter((d) => d.state === "expiring").length;

  const deadlines: DeadlineRow[] = assessed
    .slice()
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6)
    .map((a) => ({
      id: a.tender.id,
      title: a.tender.title,
      reference: a.tender.reference,
      closingAt: a.tender.closingAt,
      daysLeft: a.daysLeft,
      blockers: a.readiness.blockers,
    }));

  const compliance: ComplianceRow[] = assessed
    .slice()
    .sort((a, b) => a.progress.pct - b.progress.pct)
    .slice(0, 6)
    .map((a) => ({ id: a.tender.id, title: a.tender.title, progress: a.progress }));

  const ordersValue = orders.reduce((sum, o) => sum + o.subtotal, 0);

  return (
    <div className="container max-w-5xl py-10">
      <AdminNav
        current="/admin"
        title="Dashboard"
        description="Where every bid stands, and what needs attention first."
      />

      <RunStatus run={run} overdueHours={OVERDUE_HOURS} now={now} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open bids"
          value={open.length}
          hint={`${tenders.length} tracked in total`}
          icon={FileCheck}
          href="/admin/tenders"
        />
        <StatTile
          label="Closing this week"
          value={closingThisWeek}
          hint={closingThisWeek ? "Needs attention now" : "Nothing due in 7 days"}
          tone={closingThisWeek ? "warning" : "neutral"}
          icon={CalendarClock}
          href="/admin/tenders"
        />
        <StatTile
          label={blocked ? "Bids blocked" : "Bids ready"}
          value={blocked ? blocked : ready}
          hint={
            blocked
              ? `${ready} ready to submit`
              : open.length
                ? "All open bids are compliant"
                : "No open bids"
          }
          tone={blocked ? "critical" : ready ? "good" : "neutral"}
          icon={blocked ? XCircle : CheckCircle2}
          href="/admin/tenders"
        />
        <StatTile
          label="Documents"
          value={expired ? `${expired} expired` : expiring ? `${expiring} expiring` : documents.length}
          hint={
            expired
              ? "Renew before your next bid"
              : expiring
                ? "Expiring within 30 days"
                : documents.length
                  ? "All valid"
                  : "Nothing recorded yet"
          }
          tone={expired ? "critical" : expiring ? "warning" : documents.length ? "good" : "neutral"}
          icon={FolderLock}
          href="/admin/documents"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Closing soonest" action={{ href: "/admin/tenders", label: "All tenders" }}>
          <Deadlines rows={deadlines} />
        </Panel>
        <Panel title="Documents gathered" action={{ href: "/admin/tenders", label: "Open a bid" }}>
          <Compliance rows={compliance} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Compliance register"
          action={{ href: "/admin/documents", label: "Manage" }}
        >
          <DocumentStatus rows={docRows} />
        </Panel>
        <Panel title="Shop" action={{ href: "/admin/shop", label: "Manage" }}>
          <ShopSummary
            orders={orders.length}
            value={ordersValue}
            messages={messages.length}
            products={products.length}
          />
        </Panel>
      </div>

      {!open.length ? (
        <p className="mt-6 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No bids in progress.{" "}
          <Link href="/admin/tenders/search" className="font-medium underline">
            <Search className="mr-1 inline h-3.5 w-3.5" />
            Search live government tenders
          </Link>{" "}
          and import one to begin.
        </p>
      ) : null}
    </div>
  );
}
