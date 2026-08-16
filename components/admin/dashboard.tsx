import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileCheck,
  FolderLock,
  ShoppingBag,
  XCircle,
} from "lucide-react";

import { formatZAR } from "@/lib/utils";
import { formatDateTime, type Progress } from "@/lib/tenders";

/**
 * Admin overview.
 *
 * Every tile is a real count from D1 — nothing here is decorative. Most of this
 * data's job is *state* (ready / blocked / expiring) rather than magnitude over
 * time, which is why it is stat tiles and progress bars rather than charts:
 * a trend line over three tenders would be decoration pretending to be insight.
 *
 * Colour follows the reserved status palette (good #0ca30c, warning #fab219,
 * critical #d03b3b) and every status is paired with an icon and a word, so
 * meaning never rests on colour alone — which also covers the fact that the
 * warning yellow is deliberately below 3:1 on a light surface.
 */

/* -------------------------------- tiles --------------------------------- */

type Tone = "neutral" | "good" | "warning" | "critical";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-[#006300] dark:text-[#0ca30c]",
  warning: "text-[#8a5a00] dark:text-[#fab219]",
  critical: "text-[#b02a2a] dark:text-[#e66767]",
};

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const body = (
    <div className="h-full rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon className={`h-4 w-4 ${TONE_TEXT[tone]}`} />
      </div>
      <p className={`mt-2 text-3xl font-bold ${TONE_TEXT[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ------------------------------ panel shell ----------------------------- */

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-xs font-medium underline hover:text-accent">
            {action.label}
          </Link>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/* ------------------------------ deadlines ------------------------------- */

export interface DeadlineRow {
  id: number;
  title: string;
  reference: string;
  closingAt: string;
  daysLeft: number;
  blockers: number;
}

/**
 * Deadlines, soonest first — the bid that needs a decision today is the one at
 * the top. The bar length is days remaining against a 30-day window, so a
 * short bar reads as urgent at a glance; the day count is always printed
 * beside it, because bar length alone is not an accessible encoding.
 */
export function Deadlines({ rows }: { rows: DeadlineRow[] }) {
  if (!rows.length) {
    return <Empty>No open tenders. Find one to get started.</Empty>;
  }

  const WINDOW = 30;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const urgent = r.daysLeft <= 3;
        const soon = r.daysLeft <= 7;
        const fill = urgent ? "#d03b3b" : soon ? "#fab219" : "#2a78d6";
        const width = Math.max(2, Math.min(100, (r.daysLeft / WINDOW) * 100));
        return (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/admin/tenders/${r.id}`}
                className="truncate text-sm font-medium hover:text-accent"
              >
                {r.title}
              </Link>
              <span
                className={`shrink-0 text-xs font-semibold tabular-nums ${
                  urgent
                    ? "text-[#b02a2a] dark:text-[#e66767]"
                    : soon
                      ? "text-[#8a5a00] dark:text-[#fab219]"
                      : "text-muted-foreground"
                }`}
              >
                {r.daysLeft <= 0 ? "closed" : `${r.daysLeft}d left`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, backgroundColor: fill }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(r.closingAt)}
              {r.blockers > 0 ? (
                <span className="text-[#b02a2a] dark:text-[#e66767]">
                  {" "}
                  · {r.blockers} {r.blockers === 1 ? "blocker" : "blockers"}
                </span>
              ) : (
                <span className="text-[#006300] dark:text-[#0ca30c]"> · ready</span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------- compliance bars ---------------------------- */

export interface ComplianceRow {
  id: number;
  title: string;
  progress: Progress;
}

/** Documents gathered per bid — a single-hue magnitude, so one blue ramp. */
export function Compliance({ rows }: { rows: ComplianceRow[] }) {
  if (!rows.length) return <Empty>Nothing in progress.</Empty>;

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id}>
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/admin/tenders/${r.id}`}
              className="truncate text-sm font-medium hover:text-accent"
            >
              {r.title}
            </Link>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {r.progress.done}/{r.progress.total} · {r.progress.pct}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
              style={{ width: `${r.progress.pct}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------- document status --------------------------- */

export interface DocRow {
  id: number;
  label: string;
  expiresOn: string | null;
  state: "valid" | "expiring" | "expired" | "none";
}

export function DocumentStatus({ rows }: { rows: DocRow[] }) {
  if (!rows.length) {
    return (
      <Empty>
        Nothing recorded. Add your CSD report, Tax PIN and B-BBEE certificate so
        expiry is checked against every bid.
      </Empty>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const view = {
          expired: {
            Icon: XCircle,
            cls: "text-[#b02a2a] dark:text-[#e66767]",
            word: "Expired",
          },
          expiring: {
            Icon: AlertTriangle,
            cls: "text-[#8a5a00] dark:text-[#fab219]",
            word: "Expiring",
          },
          valid: {
            Icon: CheckCircle2,
            cls: "text-[#006300] dark:text-[#0ca30c]",
            word: "Valid",
          },
          none: {
            Icon: CheckCircle2,
            cls: "text-muted-foreground",
            word: "No expiry",
          },
        }[r.state];

        return (
          <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className={`inline-flex shrink-0 items-center gap-1.5 ${view.cls}`}>
              <view.Icon className="h-3.5 w-3.5" />
              <span className="font-medium">{view.word}</span>
              {r.expiresOn ? (
                <span className="tabular-nums text-muted-foreground">{r.expiresOn}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------- shop side ------------------------------ */

export function ShopSummary({
  orders,
  value,
  messages,
  products,
}: {
  orders: number;
  value: number;
  messages: number;
  products: number;
}) {
  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Orders</dt>
        <dd className="mt-0.5 text-2xl font-bold">{orders}</dd>
        <dd className="text-xs text-muted-foreground">{formatZAR(value)} total</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Messages</dt>
        <dd className="mt-0.5 text-2xl font-bold">{messages}</dd>
        <dd className="text-xs text-muted-foreground">from the contact form</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Products</dt>
        <dd className="mt-0.5 text-2xl font-bold">{products}</dd>
        <dd className="text-xs text-muted-foreground">live in the shop</dd>
      </div>
      <div className="flex items-end">
        <Link href="/admin/shop" className="text-xs font-medium underline hover:text-accent">
          Manage the shop →
        </Link>
      </div>
    </dl>
  );
}

export const DashboardIcons = {
  FileCheck,
  CalendarClock,
  FolderLock,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  AlertTriangle,
};
