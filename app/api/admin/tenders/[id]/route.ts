import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  addItems,
  CATEGORY_LABELS,
  deleteItems,
  deleteTender,
  getTender,
  updateItems,
  updateTender,
  type ItemCategory,
  type ItemPatch,
  type NewItemInput,
} from "@/lib/tenders";
import { validateTenderBody } from "@/lib/tender-validation";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Updates the tender and, optionally, its whole compliance matrix.
 *
 * The matrix is saved wholesale rather than one request per tick: working
 * through a 24-row checklist would otherwise be 24 round trips, and a partial
 * save would leave the readiness assessment reading a half-updated bid.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });

  const existing = await getTender(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = validateTenderBody(body);
  if ("errors" in result) {
    return Response.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  // Only ids already belonging to this tender are accepted, so a crafted
  // payload can't tick boxes on someone else's checklist. The UPDATE is
  // scoped by tender_id as well, making that a belt-and-braces check.
  const valid = new Set(existing.items.map((i) => i.id));
  const patches: ItemPatch[] = Array.isArray(body.items)
    ? (body.items as Record<string, unknown>[])
        .filter((raw) => valid.has(Number(raw.id)))
        .map((raw) => ({
          id: Number(raw.id),
          attached: raw.attached === true,
          signed: raw.signed === true,
          required: raw.required === true,
          note: typeof raw.note === "string" ? raw.note.trim().slice(0, 500) : "",
        }))
    : [];

  // Rows the user removed. Scoped to ids this tender actually owns, and
  // applied before inserts so a remove-and-re-add in one save behaves.
  const removedIds: number[] = Array.isArray(body.removedIds)
    ? (body.removedIds as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && valid.has(n))
    : [];

  // Rows the user added. A row with no label is an empty box left behind,
  // not data.
  const categories = Object.keys(CATEGORY_LABELS) as ItemCategory[];
  const newItems: NewItemInput[] = Array.isArray(body.newItems)
    ? (body.newItems as Record<string, unknown>[])
        .slice(0, 50)
        .map((raw) => ({
          category: categories.includes(String(raw.category) as ItemCategory)
            ? (String(raw.category) as ItemCategory)
            : "sbd",
          label: typeof raw.label === "string" ? raw.label.trim().slice(0, 300) : "",
          required: raw.required !== false,
          signatureRequired: raw.signatureRequired === true,
        }))
        .filter((i) => i.label)
    : [];

  await updateTender(id, result.value);
  await updateItems(id, patches);
  if (removedIds.length) await deleteItems(id, removedIds);
  if (newItems.length) await addItems(id, newItems);

  return Response.json({
    ok: true,
    id,
    added: newItems.length,
    removed: removedIds.length,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await getTender(id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await deleteTender(id);
  return Response.json({ ok: true });
}
