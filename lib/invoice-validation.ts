/**
 * Request validation for the customer, invoice and payment endpoints, shared
 * by create and edit so both enforce the same rules.
 */

import type {
  CustomerInput,
  DraftInput,
  InvoiceKind,
  InvoiceLine,
  Payment,
  PaymentMethod,
} from "@/lib/invoices";

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A plain YYYY-MM-DD date, or null when blank or malformed. */
function day(v: unknown): string | null {
  const raw = str(v, 10);
  return DAY.test(raw) && !Number.isNaN(new Date(`${raw}T12:00:00Z`).getTime()) ? raw : null;
}

const id = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export type Result<T> = { value: T } | { errors: string[] };

export function validateCustomer(body: Record<string, unknown>): Result<CustomerInput> {
  const name = str(body.name, 200);
  const terms = Number(body.termsDays ?? 30);
  const errors: string[] = [];
  if (!name) errors.push("Customer name is required.");
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
    errors.push("Payment terms must be between 0 and 365 days.");
  }
  if (errors.length) return { errors };

  return {
    value: {
      name,
      contactPerson: str(body.contactPerson, 200),
      email: str(body.email, 400),
      phone: str(body.phone, 60),
      address: str(body.address, 1000),
      vatNumber: str(body.vatNumber, 40),
      termsDays: terms,
      notes: str(body.notes, 2000),
    },
  };
}

/** A document with more lines than this is a paste gone wrong. */
const MAX_LINES = 200;

function lines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_LINES)
    .map((entry) => {
      const l = (entry ?? {}) as Record<string, unknown>;
      const quantity = Number(l.quantity);
      const unitPrice = Number(l.unitPrice);
      return {
        description: str(l.description, 500),
        unit: str(l.unit, 40) || "each",
        quantity: Number.isFinite(quantity) ? quantity : 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      };
    })
    // A blank row left at the bottom of the editor is not a line.
    .filter((l) => l.description);
}

export function validateDraft(body: Record<string, unknown>): Result<DraftInput> {
  const kind: InvoiceKind = body.kind === "quote" ? "quote" : "invoice";
  const customerId = id(body.customerId);
  const parsed = lines(body.lines);
  const issuedOn = day(body.issuedOn);
  const dueOn = day(body.dueOn);

  const errors: string[] = [];
  if (!customerId) errors.push("Choose a customer.");
  if (parsed.some((l) => l.quantity <= 0)) errors.push("Every line needs a quantity above zero.");
  // Discounts go on as their own line, so a negative price is allowed — but
  // not a negative quantity, which is how a line is accidentally inverted.
  if (issuedOn && dueOn && dueOn < issuedOn) errors.push("The due date is before the issue date.");
  if (errors.length) return { errors };

  return {
    value: {
      kind,
      customerId: customerId!,
      issuedOn,
      dueOn,
      reference: str(body.reference, 120),
      notes: str(body.notes, 2000),
      lines: parsed,
      tenderId: id(body.tenderId),
      orderReference: str(body.orderReference, 40) || null,
      quoteId: id(body.quoteId),
    },
  };
}

const METHODS: PaymentMethod[] = ["eft", "cash", "card", "other"];

export function validatePayment(body: Record<string, unknown>): Result<Omit<Payment, "id">> {
  const receivedOn = day(body.receivedOn);
  const amount = Number(body.amount);
  const errors: string[] = [];
  if (!receivedOn) errors.push("Enter the date the money arrived.");
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Enter an amount above zero.");
  if (errors.length) return { errors };

  return {
    value: {
      receivedOn: receivedOn!,
      amount,
      method: METHODS.includes(body.method as PaymentMethod) ? (body.method as PaymentMethod) : "eft",
      reference: str(body.reference, 120),
    },
  };
}
