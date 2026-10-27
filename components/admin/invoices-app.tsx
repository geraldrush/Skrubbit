"use client";

import * as React from "react";
import {
  ChevronLeft,
  FileDown,
  Loader2,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { formatZAR } from "@/lib/utils";
import {
  METHOD_LABELS,
  STATE_LABELS,
  balance,
  daysOverdue,
  invoiceState,
  totals,
  type Customer,
  type Invoice,
  type InvoiceDetail,
  type InvoiceKind,
  type InvoiceLine,
  type InvoiceState,
  type PaymentMethod,
} from "@/lib/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The whole invoicing screen, as one client component.
 *
 * The page is loaded once with everything the lists need. After that, each
 * action is one small request to /api/admin/invoices, and the answer — the
 * single record that changed — is merged into local state. Nothing reloads
 * the page or refetches the list. Moving between the list, a document and
 * the customers is a hash change, so it costs no request at all and the
 * browser's Back button still works.
 */

export interface CatalogueOption {
  name: string;
  size: string;
  price: number;
}

export interface TenderOption {
  id: number;
  reference: string;
  title: string;
  department: string;
}

export interface OrderOption {
  reference: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  items: { name: string; size: string; qty: number; price: number }[];
}

interface Props {
  today: string;
  vatRegistered: boolean;
  hasBankDetails: boolean;
  emailReady: boolean;
  customers: Customer[];
  invoices: Invoice[];
  catalogue: CatalogueOption[];
  tenders: TenderOption[];
  orders: OrderOption[];
}

/* --------------------------------- plumbing -------------------------------- */

const API = "/api/admin/invoices";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
  return data;
}

async function get<T>(query: string): Promise<T> {
  const res = await fetch(`${API}?${query}`);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
  return data;
}

/** "#doc/12", "#customers", "#new/invoice?tender=3" → parts. */
function parseHash(hash: string) {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const [view = "", arg = ""] = path.split("/");
  return { view, arg, params: new URLSearchParams(query) };
}

function go(hash: string) {
  window.location.hash = hash;
}

const SELECT =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const BADGE: Record<InvoiceState, string> = {
  draft: "bg-secondary text-foreground",
  void: "bg-secondary text-muted-foreground line-through",
  unpaid: "bg-amber-100 text-amber-900",
  "part-paid": "bg-sky-100 text-sky-900",
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-red-100 text-red-900",
  "quote-open": "bg-sky-100 text-sky-900",
  "quote-expired": "bg-secondary text-muted-foreground",
  "quote-accepted": "bg-emerald-100 text-emerald-900",
};

function StateBadge({ state }: { state: InvoiceState }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[state]}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

/* ----------------------------------- app ----------------------------------- */

export function InvoicesApp(props: Props) {
  const { today } = props;
  const [customers, setCustomers] = React.useState(props.customers);
  const [invoices, setInvoices] = React.useState(props.invoices);
  // Documents opened in this session. A second look costs no request.
  const [details, setDetails] = React.useState<Record<number, InvoiceDetail>>({});
  const [hash, setHash] = React.useState("");

  React.useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  /** Merges one changed document into the list and the cache. */
  const upsert = React.useCallback((inv: InvoiceDetail) => {
    setDetails((d) => ({ ...d, [inv.id]: inv }));
    setInvoices((list) =>
      list.some((i) => i.id === inv.id)
        ? list.map((i) => (i.id === inv.id ? inv : i))
        : [inv, ...list]
    );
  }, []);

  const drop = React.useCallback((id: number) => {
    setInvoices((list) => list.filter((i) => i.id !== id));
    setDetails(({ [id]: _gone, ...rest }) => rest);
  }, []);

  const saveCustomer = React.useCallback((c: Customer) => {
    setCustomers((list) =>
      (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]).sort(
        (a, b) => a.name.localeCompare(b.name)
      )
    );
  }, []);

  const { view, arg, params } = parseHash(hash);
  const shared = { ...props, customers, invoices, upsert, drop, saveCustomer, setCustomers };

  if (view === "doc" && Number(arg)) {
    return <DocumentView key={arg} id={Number(arg)} cached={details[Number(arg)]} {...shared} />;
  }
  if (view === "new") {
    return (
      <Editor
        key={hash}
        kind={arg === "quote" ? "quote" : "invoice"}
        tenderId={Number(params.get("tender")) || null}
        orderRef={params.get("order")}
        {...shared}
      />
    );
  }
  if (view === "customers") return <Customers {...shared} />;
  return <Overview tab={view === "quotes" ? "quote" : "invoice"} {...shared} />;
}

type Shared = Props & {
  upsert: (inv: InvoiceDetail) => void;
  drop: (id: number) => void;
  saveCustomer: (c: Customer) => void;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
};

/* -------------------------------- overview --------------------------------- */

const FILTERS = ["all", "outstanding", "overdue", "paid", "draft"] as const;
type Filter = (typeof FILTERS)[number];

function Tabs({ current }: { current: "invoice" | "quote" | "customers" }) {
  const tabs = [
    { key: "invoice", label: "Invoices", href: "#" },
    { key: "quote", label: "Quotes", href: "#quotes" },
    { key: "customers", label: "Customers", href: "#customers" },
  ];
  return (
    <div className="mb-6 flex gap-1 border-b">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            current === t.key ? "border-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-xl font-bold ${tone === "bad" ? "text-red-700" : ""}`}>{value}</p>
    </div>
  );
}

function Overview({ tab, invoices, today, vatRegistered, hasBankDetails }: Shared & { tab: InvoiceKind }) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const docs = invoices.filter((i) => i.kind === tab);
  const issued = invoices.filter((i) => i.kind === "invoice" && i.status === "issued");
  const outstanding = issued.filter((i) => balance(i) > 0);

  // Age analysis: what is owed, by how late it is.
  const ages = [
    { label: "Not yet due", sum: 0 },
    { label: "1–30 days late", sum: 0 },
    { label: "31–60", sum: 0 },
    { label: "61–90", sum: 0 },
    { label: "90+", sum: 0 },
  ];
  for (const inv of outstanding) {
    const late = daysOverdue(inv, today);
    const bucket = late === 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    ages[bucket].sum += balance(inv);
  }
  const owed = ages.reduce((s, a) => s + a.sum, 0);
  const overdue = owed - ages[0].sum;
  const month = today.slice(0, 7);
  const billedThisMonth = issued
    .filter((i) => i.issuedOn?.startsWith(month))
    .reduce((s, i) => s + i.total, 0);

  const shown = docs.filter((i) => {
    const s = invoiceState(i, today);
    if (filter === "all") return true;
    if (filter === "outstanding") return s === "unpaid" || s === "part-paid" || s === "overdue" || s === "quote-open";
    if (filter === "overdue") return s === "overdue" || s === "quote-expired";
    if (filter === "paid") return s === "paid" || s === "quote-accepted";
    return s === "draft";
  });

  return (
    <div>
      <Tabs current={tab} />

      {!hasBankDetails && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Your banking details are blank, so invoices will not say where to pay. Add them under{" "}
          <a href="/admin/documents" className="underline">Documents → Company</a>.
        </p>
      )}

      {tab === "invoice" && (
        <section className="mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Owed to you" value={formatZAR(owed)} />
            <Tile label="Overdue" value={formatZAR(overdue)} tone={overdue > 0 ? "bad" : undefined} />
            <Tile label="Invoiced this month" value={formatZAR(billedThisMonth)} />
          </div>
          {owed > 0 && (
            <div className="grid grid-cols-5 gap-px overflow-hidden rounded-lg border bg-border text-center text-xs">
              {ages.map((a) => (
                <div key={a.label} className="bg-background p-2">
                  <p className="text-muted-foreground">{a.label}</p>
                  <p className="font-semibold">{formatZAR(a.sum)}</p>
                </div>
              ))}
            </div>
          )}
          {!vatRegistered && (
            <p className="text-xs text-muted-foreground">
              Not VAT-registered, so invoices are issued without VAT. Tick “VAT registered” on the company
              profile once SARS registers you, and new invoices become tax invoices.
            </p>
          )}
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                filter === f ? "border-transparent bg-foreground text-background" : "hover:bg-secondary"
              }`}
            >
              {f === "draft" ? "Drafts" : f === "overdue" && tab === "quote" ? "Expired" : f === "paid" && tab === "quote" ? "Invoiced" : f}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => go(`#new/${tab}`)}>
          <Plus className="mr-1 h-4 w-4" /> New {tab === "quote" ? "quote" : "invoice"}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {docs.length ? "Nothing matches this filter." : `No ${tab === "quote" ? "quotes" : "invoices"} yet.`}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {shown.map((i) => {
            const state = invoiceState(i, today);
            return (
              <li key={i.id}>
                <a href={`#doc/${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-secondary/50">
                  <span className="w-20 font-mono text-xs text-muted-foreground">{i.number ?? "draft"}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{i.customerName || "—"}</span>
                  <span className="text-xs text-muted-foreground">{i.issuedOn ?? ""}</span>
                  <StateBadge state={state} />
                  <span className="w-28 text-right font-semibold">
                    {formatZAR(state === "part-paid" || state === "overdue" ? balance(i) : i.total)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------- customers -------------------------------- */

const blankCustomer = (): Omit<Customer, "id"> => ({
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  vatNumber: "",
  termsDays: 30,
  notes: "",
});

function CustomerFields({
  value,
  onChange,
}: {
  value: Omit<Customer, "id">;
  onChange: (v: Omit<Customer, "id">) => void;
}) {
  const set = (patch: Partial<Omit<Customer, "id">>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label>Name</Label>
        <Input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="SAPS Tshaulu" />
      </div>
      <div className="space-y-1">
        <Label>Attention</Label>
        <Input value={value.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} placeholder="Station Commander" />
      </div>
      <div className="space-y-1">
        <Label>Email (comma-separated)</Label>
        <Input value={value.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Phone</Label>
        <Input value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Payment terms (days)</Label>
        <Input
          type="number"
          min={0}
          max={365}
          value={value.termsDays}
          onChange={(e) => set({ termsDays: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label>Address</Label>
        <Textarea rows={2} value={value.address} onChange={(e) => set({ address: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Their VAT number</Label>
        <Input value={value.vatNumber} onChange={(e) => set({ vatNumber: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label>Notes</Label>
        <Input value={value.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}

function Customers({ customers, invoices, today, saveCustomer, setCustomers }: Shared) {
  const [editing, setEditing] = React.useState<number | "new" | null>(null);
  const [draft, setDraft] = React.useState(blankCustomer());
  const [busy, setBusy] = React.useState(false);

  function open(c: Customer | null) {
    setEditing(c ? c.id : "new");
    setDraft(c ? { ...c } : blankCustomer());
  }

  async function save() {
    setBusy(true);
    try {
      const { customer } = await call<{ customer: Customer }>({
        action: "saveCustomer",
        id: editing === "new" ? null : editing,
        ...draft,
      });
      saveCustomer(customer);
      setEditing(null);
      toast.success("Customer saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await call({ action: "deleteCustomer", id: c.id });
      setCustomers((list) => list.filter((x) => x.id !== c.id));
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const owing = (id: number) =>
    invoices
      .filter((i) => i.customerId === id && i.kind === "invoice" && i.status === "issued")
      .reduce((s, i) => s + balance(i), 0);

  const editor = (
    <div className="space-y-3 rounded-lg border bg-secondary/30 p-4">
      <CustomerFields value={draft} onChange={setDraft} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy || !draft.name.trim()}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <Tabs current="customers" />
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => open(null)}>
          <Plus className="mr-1 h-4 w-4" /> New customer
        </Button>
      </div>
      {editing === "new" && <div className="mb-4">{editor}</div>}
      {customers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No customers yet. They are also added from the invoice screen.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {customers.map((c) =>
            editing === c.id ? (
              <li key={c.id} className="p-3">
                {editor}
                <button type="button" onClick={() => remove(c)} className="mt-2 text-xs text-red-700 hover:underline">
                  Delete customer
                </button>
              </li>
            ) : (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c)}
                  className="flex w-full flex-wrap items-baseline gap-x-3 p-3 text-left hover:bg-secondary/50"
                >
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.email || c.phone}</span>
                  <span className="w-28 text-right text-sm">
                    {owing(c.id) > 0 ? <span className="font-semibold">{formatZAR(owing(c.id))} owed</span> : null}
                  </span>
                </button>
              </li>
            )
          )}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">As at {today}.</p>
    </div>
  );
}

/* ---------------------------------- editor --------------------------------- */

interface LineDraft {
  key: number;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

let lineKey = 0;
const toDraft = (l: InvoiceLine): LineDraft => ({
  key: ++lineKey,
  description: l.description,
  unit: l.unit,
  quantity: String(l.quantity),
  unitPrice: String(l.unitPrice),
});
const blankLine = (): LineDraft => ({ key: ++lineKey, description: "", unit: "each", quantity: "1", unitPrice: "" });
const toLine = (d: LineDraft): InvoiceLine => ({
  description: d.description.trim(),
  unit: d.unit.trim() || "each",
  quantity: Number(d.quantity) || 0,
  unitPrice: Number(d.unitPrice) || 0,
});

function Editor({
  kind,
  tenderId: initialTender,
  orderRef,
  existing,
  customers,
  catalogue,
  tenders,
  orders,
  vatRegistered,
  upsert,
  drop,
  saveCustomer,
}: Shared & {
  kind: InvoiceKind;
  tenderId?: number | null;
  orderRef?: string | null;
  existing?: InvoiceDetail;
}) {
  const [customerId, setCustomerId] = React.useState<number | "new" | "">(existing?.customerId ?? "");
  const [newCustomer, setNewCustomer] = React.useState(blankCustomer());
  const [lines, setLines] = React.useState<LineDraft[]>(
    existing?.lines.length ? existing.lines.map(toDraft) : [blankLine()]
  );
  const [issuedOn, setIssuedOn] = React.useState(existing?.issuedOn ?? "");
  const [dueOn, setDueOn] = React.useState(existing?.dueOn ?? "");
  const [reference, setReference] = React.useState(existing?.reference ?? "");
  const [notes, setNotes] = React.useState(existing?.notes ?? "");
  const [tenderId, setTenderId] = React.useState<number | null>(existing?.tenderId ?? null);
  const [orderReference, setOrderReference] = React.useState<string | null>(existing?.orderReference ?? null);
  const [busy, setBusy] = React.useState<"" | "save" | "issue">("");

  /** Replaces blank rows with these, keeps any the user has already typed. */
  function addLines(more: InvoiceLine[]) {
    setLines((ls) => [...ls.filter((l) => l.description.trim()), ...more.map(toDraft)]);
  }

  async function fromTender(id: number) {
    try {
      const { lines: tl } = await get<{ lines: InvoiceLine[] }>(`tender=${id}`);
      if (!tl.length) toast.message("That tender has no pricing schedule yet.");
      addLines(tl);
      setTenderId(id);
      const t = tenders.find((x) => x.id === id);
      if (t && !reference) setReference(t.reference);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function fromOrder(ref: string) {
    const o = orders.find((x) => x.reference === ref);
    if (!o) return;
    addLines(o.items.map((i) => ({ description: `${i.name} (${i.size})`, unit: "each", quantity: i.qty, unitPrice: i.price })));
    setOrderReference(o.reference);
    if (!reference) setReference(o.reference);
    // Bill the customer we already have, or start a new one from the order.
    const match = customers.find(
      (c) => (o.email && c.email.toLowerCase().includes(o.email.toLowerCase())) || c.name.toLowerCase() === o.name.toLowerCase()
    );
    if (match) setCustomerId(match.id);
    else {
      setCustomerId("new");
      setNewCustomer({ ...blankCustomer(), name: o.name, email: o.email, phone: o.phone, address: o.address });
    }
  }

  // Started from a link on a tender or an order: pull its lines in once.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || existing) return;
    seeded.current = true;
    if (initialTender) void fromTender(initialTender);
    if (orderRef) fromOrder(orderRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(key: number, change: Partial<LineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  const parsed = lines.map(toLine).filter((l) => l.description);
  const sums = totals(parsed, vatRegistered ? 0.15 : 0);

  async function save(andIssue: boolean) {
    setBusy(andIssue ? "issue" : "save");
    try {
      let cid = customerId;
      if (cid === "new") {
        const { customer } = await call<{ customer: Customer }>({ action: "saveCustomer", ...newCustomer });
        saveCustomer(customer);
        cid = customer.id;
        setCustomerId(cid);
      }
      let { invoice } = await call<{ invoice: InvoiceDetail }>({
        action: "saveDraft",
        id: existing?.id,
        kind,
        customerId: cid,
        issuedOn,
        dueOn,
        reference,
        notes,
        lines: parsed,
        tenderId,
        orderReference,
        quoteId: existing?.quoteId,
      });
      if (andIssue) {
        if (!confirm(`Issue this ${kind}? It gets its number and can no longer be edited.`)) {
          upsert(invoice);
          go(`#doc/${invoice.id}`);
          return;
        }
        ({ invoice } = await call<{ invoice: InvoiceDetail }>({ action: "issue", id: invoice.id }));
        toast.success(`${invoice.number} issued`);
      } else {
        toast.success("Draft saved");
      }
      upsert(invoice);
      go(`#doc/${invoice.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!existing || !confirm("Delete this draft?")) return;
    try {
      await call({ action: "deleteDraft", id: existing.id });
      drop(existing.id);
      go(kind === "quote" ? "#quotes" : "#");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const ready = (customerId === "new" ? newCustomer.name.trim() : customerId) && parsed.length > 0;

  return (
    <div className="space-y-6">
      <a href={kind === "quote" ? "#quotes" : "#"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
        <ChevronLeft className="h-4 w-4" /> All {kind === "quote" ? "quotes" : "invoices"}
      </a>
      <h2 className="font-display text-2xl font-bold">
        {existing ? "Edit draft" : `New ${kind === "quote" ? "quote" : "invoice"}`}
      </h2>

      <section className="space-y-2">
        <Label>Customer</Label>
        <select
          className={SELECT}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value === "new" ? "new" : e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Choose…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="new">+ New customer…</option>
        </select>
        {customerId === "new" && (
          <div className="rounded-lg border bg-secondary/30 p-4">
            <CustomerFields value={newCustomer} onChange={setNewCustomer} />
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-semibold">Lines</h3>
          <div className="flex flex-wrap gap-2">
            {!existing && tenders.length > 0 && (
              <select className={`${SELECT} h-9 w-auto`} value="" onChange={(e) => e.target.value && fromTender(Number(e.target.value))}>
                <option value="">From a tender…</option>
                {tenders.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reference} — {t.title.slice(0, 40)}
                  </option>
                ))}
              </select>
            )}
            {!existing && orders.length > 0 && (
              <select className={`${SELECT} h-9 w-auto`} value="" onChange={(e) => e.target.value && fromOrder(e.target.value)}>
                <option value="">From a shop order…</option>
                {orders.map((o) => (
                  <option key={o.reference} value={o.reference}>
                    {o.reference} — {o.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className={`${SELECT} h-9 w-auto`}
              value=""
              onChange={(e) => {
                const p = catalogue[Number(e.target.value)];
                if (p) addLines([{ description: `${p.name} ${p.size}`, unit: "each", quantity: 1, unitPrice: p.price }]);
              }}
            >
              <option value="">Add a product…</option>
              {catalogue.map((p, i) => (
                <option key={i} value={i}>
                  {p.name} {p.size} — {formatZAR(p.price)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-12 sm:col-span-5"
                placeholder="Description (a service, product or discount)"
                value={l.description}
                onChange={(e) => patch(l.key, { description: e.target.value })}
              />
              <Input
                className="col-span-3 sm:col-span-1"
                inputMode="decimal"
                aria-label="Quantity"
                value={l.quantity}
                onChange={(e) => patch(l.key, { quantity: e.target.value })}
              />
              <Input
                className="col-span-3 sm:col-span-2"
                aria-label="Unit"
                value={l.unit}
                onChange={(e) => patch(l.key, { unit: e.target.value })}
              />
              <Input
                className="col-span-3 sm:col-span-2"
                inputMode="decimal"
                placeholder="Price"
                value={l.unitPrice}
                onChange={(e) => patch(l.key, { unitPrice: e.target.value })}
              />
              <div className="col-span-3 flex items-center justify-end gap-1 sm:col-span-2">
                <span className="text-sm tabular-nums">{formatZAR(toLine(l).quantity * toLine(l).unitPrice)}</span>
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blankLine()]))}
                  className="p-1 text-muted-foreground hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          <Plus className="mr-1 h-4 w-4" /> Line
        </Button>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          {vatRegistered && (
            <>
              <p className="flex justify-between"><span className="text-muted-foreground">Subtotal</span>{formatZAR(sums.subtotal)}</p>
              <p className="flex justify-between"><span className="text-muted-foreground">VAT 15%</span>{formatZAR(sums.vat)}</p>
            </>
          )}
          <p className="flex justify-between font-display text-lg font-bold"><span>Total</span>{formatZAR(sums.total)}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
          <p className="text-xs text-muted-foreground">Blank: the day it is issued.</p>
        </div>
        <div className="space-y-1">
          <Label>{kind === "quote" ? "Valid until" : "Due date"}</Label>
          <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Blank: {kind === "quote" ? "30 days" : "the customer’s terms"}.
          </p>
        </div>
        <div className="space-y-1">
          <Label>Their order / PO number</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label>Notes (printed)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery to…, warranty, etc." />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(true)} disabled={!ready || busy !== ""}>
          {busy === "issue" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          Save and issue
        </Button>
        <Button variant="outline" onClick={() => save(false)} disabled={!ready || busy !== ""}>
          {busy === "save" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save draft
        </Button>
        {existing && (
          <Button variant="ghost" className="text-red-700" onClick={remove}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete draft
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- document --------------------------------- */

function DocumentView(props: Shared & { id: number; cached?: InvoiceDetail }) {
  const { id, cached, upsert, today, emailReady } = props;
  const [inv, setInv] = React.useState<InvoiceDetail | null>(cached ?? null);
  const [panel, setPanel] = React.useState<"" | "pay" | "email">("");
  const [busy, setBusy] = React.useState(false);

  // Only fetched if not already opened this session.
  React.useEffect(() => {
    if (cached) {
      setInv(cached);
      return;
    }
    get<{ invoice: InvoiceDetail }>(`id=${id}`)
      .then(({ invoice }) => upsert(invoice))
      .catch((e) => toast.error((e as Error).message));
  }, [id, cached, upsert]);

  if (!inv) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (inv.status === "draft") return <Editor {...props} kind={inv.kind} existing={inv} />;

  const state = invoiceState(inv, today);
  const isQuote = inv.kind === "quote";
  const owed = balance(inv);

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      const res = await call<{ invoice: InvoiceDetail; quote?: InvoiceDetail }>({ id: inv!.id, ...body });
      if (res.quote) upsert(res.quote);
      upsert(res.invoice);
      setPanel("");
      toast.success(done);
      if (res.invoice.id !== inv!.id) go(`#doc/${res.invoice.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <a href={isQuote ? "#quotes" : "#"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
        <ChevronLeft className="h-4 w-4" /> All {isQuote ? "quotes" : "invoices"}
      </a>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">
            {isQuote ? "Quote" : "Invoice"} {inv.number}
          </h2>
          <p className="font-medium">{inv.customerName}</p>
          <p className="text-sm text-muted-foreground">
            {inv.issuedOn} · {isQuote ? "valid until" : "due"} {inv.dueOn}
            {inv.reference ? ` · ref ${inv.reference}` : ""}
          </p>
          {inv.emailedAt && (
            <p className="text-xs text-muted-foreground">
              Emailed to {inv.emailedTo} on {inv.emailedAt.slice(0, 16)} UTC
            </p>
          )}
        </div>
        <StateBadge state={state} />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`${API}?id=${inv.id}&pdf=1`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-secondary"
        >
          <FileDown className="mr-1.5 h-4 w-4" /> PDF
        </a>
        {inv.status === "issued" && (
          <Button size="sm" variant="outline" onClick={() => setPanel(panel === "email" ? "" : "email")} disabled={!emailReady}
            title={emailReady ? undefined : "Email is not set up on the server"}>
            <Mail className="mr-1.5 h-4 w-4" /> Email
          </Button>
        )}
        {!isQuote && inv.status === "issued" && owed > 0 && (
          <Button size="sm" onClick={() => setPanel(panel === "pay" ? "" : "pay")}>
            Record payment
          </Button>
        )}
        {isQuote && inv.status === "issued" && (
          inv.invoicedBy ? (
            <a href={`#doc/${inv.invoicedBy}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-secondary">
              Open its invoice
            </a>
          ) : (
            <Button size="sm" onClick={() => act({ action: "convert" }, "Invoice draft created")} disabled={busy}>
              Raise invoice
            </Button>
          )
        )}
        {inv.status === "issued" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700"
            disabled={busy}
            onClick={() =>
              confirm(`Void ${inv.number}? The number stays used, marked VOID. Issue a new one to replace it.`) &&
              act({ action: "void" }, `${inv.number} voided`)
            }
          >
            Void
          </Button>
        )}
      </div>

      {panel === "pay" && <PaymentForm owed={owed} today={today} busy={busy} onSubmit={(p) => act({ action: "addPayment", ...p }, "Payment recorded")} />}
      {panel === "email" && (
        <EmailForm inv={inv} busy={busy} onSubmit={(to, message) => act({ action: "email", to, message }, `Sent to ${to}`)} />
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2">Unit</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td className="p-2">{l.description}</td>
                <td className="p-2 text-right tabular-nums">{l.quantity}</td>
                <td className="p-2">{l.unit}</td>
                <td className="p-2 text-right tabular-nums">{formatZAR(l.unitPrice)}</td>
                <td className="p-2 text-right tabular-nums">{formatZAR(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto max-w-xs space-y-1 text-sm">
        {inv.vatRate > 0 && (
          <>
            <p className="flex justify-between"><span className="text-muted-foreground">Subtotal</span>{formatZAR(inv.subtotal)}</p>
            <p className="flex justify-between"><span className="text-muted-foreground">VAT</span>{formatZAR(inv.vat)}</p>
          </>
        )}
        <p className="flex justify-between font-semibold"><span>Total</span>{formatZAR(inv.total)}</p>
        {!isQuote && (
          <>
            <p className="flex justify-between"><span className="text-muted-foreground">Paid</span>{formatZAR(inv.paid)}</p>
            <p className="flex justify-between font-display text-lg font-bold"><span>Balance</span>{formatZAR(owed)}</p>
          </>
        )}
      </div>

      {!isQuote && inv.payments.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Payments</h3>
          <ul className="divide-y rounded-lg border text-sm">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-2">
                <span className="w-24">{p.receivedOn}</span>
                <span className="w-12 text-muted-foreground">{METHOD_LABELS[p.method]}</span>
                <span className="flex-1 text-muted-foreground">{p.reference}</span>
                <span className="font-medium tabular-nums">{formatZAR(p.amount)}</span>
                <button
                  type="button"
                  aria-label="Remove payment"
                  disabled={busy}
                  onClick={() => confirm("Remove this payment?") && act({ action: "deletePayment", paymentId: p.id }, "Payment removed")}
                  className="text-muted-foreground hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inv.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{inv.notes}</p>}

      <p className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {inv.tenderId && <a className="hover:text-accent" href={`/admin/tenders/${inv.tenderId}`}>From a tender</a>}
        {inv.quoteId && <a className="hover:text-accent" href={`#doc/${inv.quoteId}`}>From a quote</a>}
        {inv.orderReference && <span>From shop order {inv.orderReference}</span>}
        <a className="inline-flex items-center gap-1 hover:text-accent" href="#customers"><Users className="h-3 w-3" /> Customers</a>
      </p>
    </div>
  );
}

function PaymentForm({
  owed,
  today,
  busy,
  onSubmit,
}: {
  owed: number;
  today: string;
  busy: boolean;
  onSubmit: (p: { receivedOn: string; amount: number; method: PaymentMethod; reference: string }) => void;
}) {
  const [receivedOn, setReceivedOn] = React.useState(today);
  const [amount, setAmount] = React.useState(String(owed));
  const [method, setMethod] = React.useState<PaymentMethod>("eft");
  const [reference, setReference] = React.useState("");

  return (
    <form
      className="grid gap-3 rounded-lg border bg-secondary/30 p-4 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ receivedOn, amount: Number(amount), method, reference });
      }}
    >
      <div className="space-y-1">
        <Label>Received on</Label>
        <Input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label>Amount</Label>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label>Method</Label>
        <select className={SELECT} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {Object.entries(METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>Bank reference</Label>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <div className="sm:col-span-4">
        <Button size="sm" type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save payment
        </Button>
      </div>
    </form>
  );
}

function EmailForm({
  inv,
  busy,
  onSubmit,
}: {
  inv: InvoiceDetail;
  busy: boolean;
  onSubmit: (to: string, message: string) => void;
}) {
  const [to, setTo] = React.useState(inv.customerEmail);
  const [message, setMessage] = React.useState("");
  return (
    <form
      className="space-y-3 rounded-lg border bg-secondary/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(to, message);
      }}
    >
      <div className="space-y-1">
        <Label>To (comma-separated)</Label>
        <Input value={to} onChange={(e) => setTo(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label>Message</Label>
        <Textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave blank for the standard wording. The PDF is attached either way."
        />
      </div>
      <Button size="sm" type="submit" disabled={busy || !to.trim()}>
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Send
      </Button>
    </form>
  );
}
