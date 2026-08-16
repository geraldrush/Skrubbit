/**
 * Order enquiries and contact messages in D1.
 *
 * Both writers are public and unauthenticated, so everything is length-capped
 * before it is stored — an uncapped free-text field on an open endpoint is a
 * storage-abuse vector, not just a tidiness problem.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

function db(): D1Database {
  return getCloudflareContext().env.DB;
}

/** Trims, coerces non-strings to "", and caps length. */
export function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const LIMITS = {
  name: 200,
  phone: 60,
  email: 200,
  address: 1000,
  note: 2000,
  message: 5000,
  /** Per line item. */
  itemText: 200,
  /** A cart with more lines than this is not a real order. */
  items: 100,
} as const;

/* ------------------------------- orders -------------------------------- */

export interface OrderItem {
  name: string;
  size: string;
  qty: number;
  price: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}

export interface OrderRecord extends OrderCustomer {
  reference: string;
  items: OrderItem[];
  subtotal: number;
  createdAt: string;
}

/**
 * Normalises a client-supplied cart into storable line items.
 *
 * Quantities and prices are clamped to sane ranges rather than rejected: the
 * order is a lead to follow up by hand, so recording a slightly odd cart beats
 * losing the customer's details over a validation error.
 */
export function normaliseItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, LIMITS.items).map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const qty = Math.floor(Number(item.qty));
    const price = Number(item.price);
    return {
      name: clamp(item.name, LIMITS.itemText),
      size: clamp(item.size, LIMITS.itemText),
      qty: Number.isFinite(qty) && qty > 0 ? Math.min(qty, 100_000) : 1,
      price: Number.isFinite(price) && price >= 0 ? price : 0,
    };
  });
}

export function subtotalOf(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

/** Tolerates malformed JSON so one bad row can't break the admin console. */
function parseItems(raw: string): OrderItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normaliseItems(parsed) : [];
  } catch {
    return [];
  }
}

export async function recordOrder(
  reference: string,
  items: OrderItem[],
  customer: OrderCustomer
): Promise<void> {
  await db()
    .prepare(
      `INSERT INTO orders
         (reference, items, subtotal, customer_name, customer_phone,
          customer_email, customer_address, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      reference,
      JSON.stringify(items),
      subtotalOf(items),
      customer.name,
      customer.phone,
      customer.email,
      customer.address,
      customer.note
    )
    .run();
}

interface OrderRow {
  reference: string;
  items: string;
  subtotal: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  note: string;
  created_at: string;
}

export async function getRecentOrders(limit = 25): Promise<OrderRecord[]> {
  const { results } = await db()
    .prepare("SELECT * FROM orders ORDER BY created_at DESC, reference DESC LIMIT ?")
    .bind(limit)
    .all<OrderRow>();

  return results.map((r) => ({
    reference: r.reference,
    items: parseItems(r.items),
    subtotal: r.subtotal,
    name: r.customer_name,
    phone: r.customer_phone,
    email: r.customer_email,
    address: r.customer_address,
    note: r.note,
    createdAt: r.created_at,
  }));
}

/* --------------------------- contact messages --------------------------- */

export interface ContactRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
}

export async function recordContactMessage(
  name: string,
  email: string,
  phone: string,
  message: string
): Promise<void> {
  await db()
    .prepare(
      "INSERT INTO contact_messages (name, email, phone, message) VALUES (?, ?, ?, ?)"
    )
    .bind(name, email, phone, message)
    .run();
}

interface ContactRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  created_at: string;
}

export async function getRecentContactMessages(limit = 25): Promise<ContactRecord[]> {
  const { results } = await db()
    .prepare("SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<ContactRow>();

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    message: r.message,
    createdAt: r.created_at,
  }));
}
