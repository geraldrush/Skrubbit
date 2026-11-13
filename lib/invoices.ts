/**
 * Customers, quotes, invoices and payments in D1.
 *
 * An invoice is a draft until it is issued. Issuing gives it the next number,
 * fixes the VAT rate and takes a copy of the customer's particulars — from then
 * on it is a record of what was sent, and it is never edited again. A mistake
 * is put right by voiding it and issuing another, which is what an auditor or
 * SARS expects to see.
 *
 * Paid, part-paid and overdue are not stored. They are worked out from the
 * payments and the due date every time, so they cannot drift out of step.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { VAT_RATE } from "@/lib/tenders";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

/** Rand to the cent. Floating-point sums otherwise print as R5 210.4299999. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Adds days to a plain YYYY-MM-DD date. */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------- customers ------------------------------ */

export interface Customer {
  id: number;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  vatNumber: string;
  termsDays: number;
  notes: string;
}

export type CustomerInput = Omit<Customer, "id">;

interface CustomerRow {
  id: number;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  vat_number: string;
  terms_days: number;
  notes: string;
}

const toCustomer = (r: CustomerRow): Customer => ({
  id: r.id,
  name: r.name,
  contactPerson: r.contact_person,
  email: r.email,
  phone: r.phone,
  address: r.address,
  vatNumber: r.vat_number,
  termsDays: r.terms_days,
  notes: r.notes,
});

export async function listCustomers(): Promise<Customer[]> {
  const { results } = await db()
    .prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE")
    .all<CustomerRow>();
  return results.map(toCustomer);
}

export async function getCustomer(id: number): Promise<Customer | null> {
  const row = await db()
    .prepare("SELECT * FROM customers WHERE id = ?")
    .bind(id)
    .first<CustomerRow>();
  return row ? toCustomer(row) : null;
}

export async function createCustomer(c: CustomerInput): Promise<number> {
  const row = await db()
    .prepare(
      `INSERT INTO customers
         (name, contact_person, email, phone, address, vat_number, terms_days, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(c.name, c.contactPerson, c.email, c.phone, c.address, c.vatNumber, c.termsDays, c.notes)
    .first<{ id: number }>();
  return row!.id;
}

export async function updateCustomer(id: number, c: CustomerInput): Promise<void> {
  await db()
    .prepare(
      `UPDATE customers SET
         name = ?, contact_person = ?, email = ?, phone = ?, address = ?,
         vat_number = ?, terms_days = ?, notes = ?
       WHERE id = ?`
    )
    .bind(
      c.name,
      c.contactPerson,
      c.email,
      c.phone,
      c.address,
      c.vatNumber,
      c.termsDays,
      c.notes,
      id
    )
    .run();
}

/**
 * Deletes a customer who has never been billed.
 *
 * One with documents stays: their invoices are records, and a record that
 * points at nobody is a gap in the books.
 */
export async function deleteCustomer(id: number): Promise<boolean> {
  const used = await db()
    .prepare("SELECT 1 FROM invoices WHERE customer_id = ? LIMIT 1")
    .bind(id)
    .first();
  if (used) return false;
  await db().prepare("DELETE FROM customers WHERE id = ?").bind(id).run();
  return true;
}

/* -------------------------------- invoices ------------------------------- */

export type InvoiceKind = "invoice" | "quote";
export type InvoiceStatus = "draft" | "issued" | "void";

/** What the admin sees: the stored status, refined by payments and dates. */
export type InvoiceState =
  | "draft"
  | "void"
  | "unpaid"
  | "part-paid"
  | "paid"
  | "overdue"
  | "quote-open"
  | "quote-expired"
  | "quote-accepted";

export const STATE_LABELS: Record<InvoiceState, string> = {
  draft: "Draft",
  void: "Void",
  unpaid: "Unpaid",
  "part-paid": "Part-paid",
  paid: "Paid",
  overdue: "Overdue",
  "quote-open": "Open",
  "quote-expired": "Expired",
  "quote-accepted": "Invoiced",
};

export const PREFIX: Record<InvoiceKind, string> = { invoice: "INV", quote: "Q" };

export interface InvoiceLine {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export type PaymentMethod = "eft" | "cash" | "card" | "other";

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  eft: "EFT",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export interface Payment {
  id: number;
  receivedOn: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
}

export interface Invoice {
  id: number;
  kind: InvoiceKind;
  number: string | null;
  status: InvoiceStatus;
  customerId: number | null;
  customerName: string;
  customerContact: string;
  customerAddress: string;
  customerEmail: string;
  customerVat: string;
  issuedOn: string | null;
  dueOn: string | null;
  reference: string;
  notes: string;
  vatRate: number;
  tenderId: number | null;
  orderReference: string | null;
  quoteId: number | null;
  emailedAt: string | null;
  emailedTo: string;
  createdAt: string;
  /** Excluding VAT, VAT, and the amount due. */
  subtotal: number;
  vat: number;
  total: number;
  paid: number;
  /** Set on a quote once an invoice has been raised from it. */
  invoicedBy: number | null;
}

export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  payments: Payment[];
}

interface InvoiceRow {
  id: number;
  kind: InvoiceKind;
  number: string | null;
  status: InvoiceStatus;
  customer_id: number | null;
  customer_name: string;
  customer_contact: string;
  customer_address: string;
  customer_email: string;
  customer_vat: string;
  issued_on: string | null;
  due_on: string | null;
  reference: string;
  notes: string;
  vat_rate: number;
  tender_id: number | null;
  order_reference: string | null;
  quote_id: number | null;
  emailed_at: string | null;
  emailed_to: string;
  created_at: string;
  /* Aggregates joined in by the list query. */
  subtotal: number | null;
  paid: number | null;
  invoiced_by: number | null;
}

export function totals(lines: InvoiceLine[], vatRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
  const vat = round2(subtotal * vatRate);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

function toInvoice(r: InvoiceRow): Invoice {
  const subtotal = round2(r.subtotal ?? 0);
  const vat = round2(subtotal * r.vat_rate);
  return {
    id: r.id,
    kind: r.kind,
    number: r.number,
    status: r.status,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerContact: r.customer_contact,
    customerAddress: r.customer_address,
    customerEmail: r.customer_email,
    customerVat: r.customer_vat,
    issuedOn: r.issued_on,
    dueOn: r.due_on,
    reference: r.reference,
    notes: r.notes,
    vatRate: r.vat_rate,
    tenderId: r.tender_id,
    orderReference: r.order_reference,
    quoteId: r.quote_id,
    emailedAt: r.emailed_at,
    emailedTo: r.emailed_to,
    createdAt: r.created_at,
    subtotal,
    vat,
    total: round2(subtotal + vat),
    paid: round2(r.paid ?? 0),
    invoicedBy: r.invoiced_by,
  };
}

/** Outstanding on an invoice. Never negative, even if it was overpaid. */
export function balance(inv: Invoice): number {
  return Math.max(0, round2(inv.total - inv.paid));
}

export function invoiceState(inv: Invoice, today: string): InvoiceState {
  if (inv.status === "draft") return "draft";
  if (inv.status === "void") return "void";
  if (inv.kind === "quote") {
    if (inv.invoicedBy) return "quote-accepted";
    return inv.dueOn && inv.dueOn < today ? "quote-expired" : "quote-open";
  }
  if (balance(inv) === 0) return "paid";
  if (inv.dueOn && inv.dueOn < today) return "overdue";
  return inv.paid > 0 ? "part-paid" : "unpaid";
}

/** Days past due, for the age analysis. Zero when not yet due. */
export function daysOverdue(inv: Invoice, today: string): number {
  if (!inv.dueOn || inv.dueOn >= today) return 0;
  const ms =
    new Date(`${today}T12:00:00Z`).getTime() - new Date(`${inv.dueOn}T12:00:00Z`).getTime();
  return Math.round(ms / 864e5);
}

/*
 * Line totals are rounded per line, as printed, then summed — so the list,
 * the PDF and the detail page all show the same subtotal to the cent.
 */
const SELECT_INVOICES = `
  SELECT i.*,
    (SELECT SUM(ROUND(l.quantity * l.unit_price, 2)) FROM invoice_lines l WHERE l.invoice_id = i.id) AS subtotal,
    (SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id) AS paid,
    (SELECT MIN(q.id) FROM invoices q WHERE q.quote_id = i.id AND q.status != 'void') AS invoiced_by
  FROM invoices i`;

export async function listInvoices(kind?: InvoiceKind): Promise<Invoice[]> {
  const stmt = kind
    ? db()
        .prepare(
          `${SELECT_INVOICES} WHERE i.kind = ? ORDER BY COALESCE(i.issued_on, i.created_at) DESC, i.id DESC`
        )
        .bind(kind)
    : db().prepare(
        `${SELECT_INVOICES} ORDER BY COALESCE(i.issued_on, i.created_at) DESC, i.id DESC`
      );
  const { results } = await stmt.all<InvoiceRow>();
  return results.map(toInvoice);
}

export async function invoicesForTender(tenderId: number): Promise<Invoice[]> {
  const { results } = await db()
    .prepare(`${SELECT_INVOICES} WHERE i.tender_id = ? ORDER BY i.id`)
    .bind(tenderId)
    .all<InvoiceRow>();
  return results.map(toInvoice);
}

export async function getInvoice(id: number): Promise<InvoiceDetail | null> {
  const d = db();
  const row = await d.prepare(`${SELECT_INVOICES} WHERE i.id = ?`).bind(id).first<InvoiceRow>();
  if (!row) return null;

  const [lines, payments] = await Promise.all([
    d
      .prepare("SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position")
      .bind(id)
      .all<{ description: string; unit: string; quantity: number; unit_price: number }>(),
    d
      .prepare("SELECT * FROM payments WHERE invoice_id = ? ORDER BY received_on, id")
      .bind(id)
      .all<{
        id: number;
        received_on: string;
        amount: number;
        method: PaymentMethod;
        reference: string;
      }>(),
  ]);

  return {
    ...toInvoice(row),
    lines: lines.results.map((l) => ({
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unit_price,
    })),
    payments: payments.results.map((p) => ({
      id: p.id,
      receivedOn: p.received_on,
      amount: p.amount,
      method: p.method,
      reference: p.reference,
    })),
  };
}

export interface DraftInput {
  kind: InvoiceKind;
  customerId: number;
  issuedOn: string | null;
  dueOn: string | null;
  reference: string;
  notes: string;
  lines: InvoiceLine[];
  tenderId: number | null;
  orderReference: string | null;
  quoteId: number | null;
}

/** The customer's particulars as they are printed on the document. */
async function snapshot(customerId: number) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  return [c.name, c.contactPerson, c.address, c.email, c.vatNumber] as const;
}

function lineStatements(d: D1Database, invoiceId: number, lines: InvoiceLine[]) {
  return lines.map((l, i) =>
    d
      .prepare(
        `INSERT INTO invoice_lines (invoice_id, description, unit, quantity, unit_price, position)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(invoiceId, l.description, l.unit, l.quantity, l.unitPrice, i)
  );
}

export async function createDraft(
  input: DraftInput,
  vatRegistered: boolean
): Promise<number | null> {
  const snap = await snapshot(input.customerId);
  if (!snap) return null;

  const d = db();
  const row = await d
    .prepare(
      `INSERT INTO invoices
         (kind, customer_id, customer_name, customer_contact, customer_address,
          customer_email, customer_vat, issued_on, due_on, reference, notes,
          vat_rate, tender_id, order_reference, quote_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(
      input.kind,
      input.customerId,
      ...snap,
      input.issuedOn,
      input.dueOn,
      input.reference,
      input.notes,
      vatRegistered ? VAT_RATE : 0,
      input.tenderId,
      input.orderReference,
      input.quoteId
    )
    .first<{ id: number }>();

  const id = row!.id;
  if (input.lines.length) await d.batch(lineStatements(d, id, input.lines));
  return id;
}

/**
 * Replaces a draft's contents. Refuses anything already issued: the WHERE
 * clause is the guard, so a stale browser tab cannot rewrite a sent invoice.
 */
export async function updateDraft(
  id: number,
  input: Omit<DraftInput, "kind" | "tenderId" | "orderReference" | "quoteId">,
  vatRegistered: boolean
): Promise<boolean> {
  const snap = await snapshot(input.customerId);
  if (!snap) return false;

  const d = db();
  const current = await d
    .prepare("SELECT status FROM invoices WHERE id = ?")
    .bind(id)
    .first<{ status: InvoiceStatus }>();
  if (current?.status !== "draft") return false;

  await d.batch([
    d
      .prepare(
        `UPDATE invoices SET
           customer_id = ?, customer_name = ?, customer_contact = ?,
           customer_address = ?, customer_email = ?, customer_vat = ?,
           issued_on = ?, due_on = ?, reference = ?, notes = ?, vat_rate = ?
         WHERE id = ? AND status = 'draft'`
      )
      .bind(
        input.customerId,
        ...snap,
        input.issuedOn,
        input.dueOn,
        input.reference,
        input.notes,
        vatRegistered ? VAT_RATE : 0,
        id
      ),
    d.prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").bind(id),
    ...lineStatements(d, id, input.lines),
  ]);
  return true;
}

/** Only drafts can be deleted. An issued number is voided, never removed. */
export async function deleteDraft(id: number): Promise<boolean> {
  const res = await db()
    .prepare("DELETE FROM invoices WHERE id = ? AND status = 'draft'")
    .bind(id)
    .run();
  return res.meta.changes > 0;
}

/**
 * Issues a draft: next number, dates, VAT rate and customer copy, all at once.
 *
 * The number is taken and the counter moved in one batch, which D1 runs as a
 * transaction. The counter only moves if this invoice got that exact number,
 * so two clicks on Issue cannot skip one or hand out the same one twice.
 */
export async function issueDraft(
  id: number,
  today: string,
  vatRegistered: boolean
): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const d = db();
  const inv = await getInvoice(id);
  if (!inv) return { ok: false, error: "Not found." };
  if (inv.status !== "draft") return { ok: false, error: "Already issued." };
  if (!inv.customerId) return { ok: false, error: "Choose a customer first." };
  if (!inv.lines.length) return { ok: false, error: "Add at least one line." };

  const customer = await getCustomer(inv.customerId);
  if (!customer) return { ok: false, error: "The customer no longer exists." };

  const issuedOn = inv.issuedOn ?? today;
  // A quote is valid for 30 days unless told otherwise; an invoice falls due
  // on the customer's terms.
  const dueOn = inv.dueOn ?? addDays(issuedOn, inv.kind === "quote" ? 30 : customer.termsDays);
  const fmt = `${PREFIX[inv.kind]}-%04d`;

  await d.batch([
    d
      .prepare(
        `UPDATE invoices SET
           status = 'issued',
           number = (SELECT printf(?, next) FROM number_sequences WHERE name = ?),
           issued_on = ?, due_on = ?, vat_rate = ?,
           customer_name = ?, customer_contact = ?, customer_address = ?,
           customer_email = ?, customer_vat = ?
         WHERE id = ? AND status = 'draft'`
      )
      .bind(
        fmt,
        inv.kind,
        issuedOn,
        dueOn,
        vatRegistered ? VAT_RATE : 0,
        customer.name,
        customer.contactPerson,
        customer.address,
        customer.email,
        customer.vatNumber,
        id
      ),
    d
      .prepare(
        `UPDATE number_sequences SET next = next + 1
         WHERE name = ?
           AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND number = printf(?, number_sequences.next))`
      )
      .bind(inv.kind, id, fmt),
  ]);

  const issued = await d
    .prepare("SELECT number FROM invoices WHERE id = ?")
    .bind(id)
    .first<{ number: string | null }>();
  if (!issued?.number) return { ok: false, error: "Could not issue — try again." };
  return { ok: true, number: issued.number };
}

/** Voids an issued document. Its number stays taken, with "VOID" across it. */
export async function voidInvoice(id: number): Promise<boolean> {
  const res = await db()
    .prepare("UPDATE invoices SET status = 'void' WHERE id = ? AND status = 'issued'")
    .bind(id)
    .run();
  return res.meta.changes > 0;
}

/** Raises an invoice draft from a quote, copying its lines and customer. */
export async function invoiceFromQuote(
  quoteId: number,
  vatRegistered: boolean
): Promise<number | null> {
  const quote = await getInvoice(quoteId);
  if (!quote || quote.kind !== "quote" || quote.status !== "issued" || !quote.customerId) {
    return null;
  }
  // Raised already: open that one rather than billing the customer twice.
  if (quote.invoicedBy) return quote.invoicedBy;
  return createDraft(
    {
      kind: "invoice",
      customerId: quote.customerId,
      issuedOn: null,
      dueOn: null,
      reference: quote.reference,
      notes: quote.notes,
      lines: quote.lines,
      tenderId: quote.tenderId,
      orderReference: quote.orderReference,
      quoteId: quote.id,
    },
    vatRegistered
  );
}

export async function markEmailed(id: number, to: string): Promise<void> {
  await db()
    .prepare("UPDATE invoices SET emailed_at = datetime('now'), emailed_to = ? WHERE id = ?")
    .bind(to, id)
    .run();
}

/* -------------------------------- payments ------------------------------- */

export async function addPayment(invoiceId: number, p: Omit<Payment, "id">): Promise<boolean> {
  const inv = await db()
    .prepare("SELECT kind, status FROM invoices WHERE id = ?")
    .bind(invoiceId)
    .first<{ kind: InvoiceKind; status: InvoiceStatus }>();
  // Money is only ever received against an issued invoice.
  if (inv?.kind !== "invoice" || inv.status !== "issued") return false;

  await db()
    .prepare(
      `INSERT INTO payments (invoice_id, received_on, amount, method, reference)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(invoiceId, p.receivedOn, round2(p.amount), p.method, p.reference)
    .run();
  return true;
}

export async function deletePayment(invoiceId: number, paymentId: number): Promise<void> {
  await db()
    .prepare("DELETE FROM payments WHERE id = ? AND invoice_id = ?")
    .bind(paymentId, invoiceId)
    .run();
}
