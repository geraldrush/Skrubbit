/**
 * The reference library — documents the business works from.
 *
 * Separate from the compliance matrix on purpose. company_documents feeds the
 * tender pack, which encloses every certificate it holds; anything filed here
 * is internal and is never attached to anything automatically. That separation
 * is what keeps the formulation books out of a bid sent to a buyer.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type LibraryCategory = "datasheet" | "formulation" | "pricelist" | "other";

export const LIBRARY_CATEGORIES: Array<{ id: LibraryCategory; label: string }> = [
  { id: "datasheet", label: "Technical data sheets" },
  { id: "formulation", label: "Formulations" },
  { id: "pricelist", label: "Supplier price lists" },
  { id: "other", label: "Other" },
];

export interface LibraryDocument {
  id: number;
  title: string;
  category: LibraryCategory;
  notes: string;
  confidential: boolean;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface Row {
  id: number;
  title: string;
  category: string;
  notes: string;
  confidential: number;
  file_key: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

const db = () => getCloudflareContext().env.DB;

const fromRow = (r: Row): LibraryDocument => ({
  id: r.id,
  title: r.title,
  category: r.category as LibraryCategory,
  notes: r.notes,
  confidential: r.confidential === 1,
  fileKey: r.file_key,
  fileName: r.file_name,
  fileType: r.file_type,
  fileSize: r.file_size,
  uploadedAt: r.uploaded_at,
});

export async function listLibrary(): Promise<LibraryDocument[]> {
  const { results } = await db()
    .prepare(
      `SELECT * FROM library_documents
        ORDER BY CASE category
                   WHEN 'datasheet' THEN 0
                   WHEN 'formulation' THEN 1
                   WHEN 'pricelist' THEN 2
                   ELSE 3
                 END, title`
    )
    .all<Row>();
  return results.map(fromRow);
}

export async function getLibraryDocument(id: number): Promise<LibraryDocument | null> {
  const row = await db()
    .prepare("SELECT * FROM library_documents WHERE id = ?")
    .bind(id)
    .first<Row>();
  return row ? fromRow(row) : null;
}

export async function addLibraryDocument(doc: {
  title: string;
  category: LibraryCategory;
  notes: string;
  confidential: boolean;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<number> {
  const res = await db()
    .prepare(
      `INSERT INTO library_documents
         (title, category, notes, confidential, file_key, file_name, file_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      doc.title,
      doc.category,
      doc.notes,
      doc.confidential ? 1 : 0,
      doc.fileKey,
      doc.fileName,
      doc.fileType,
      doc.fileSize
    )
    .run();
  return Number(res.meta.last_row_id);
}

/** Deletes the row and the stored file together — an orphaned object in R2 is
 *  a document nobody can find and nobody can delete. */
export async function deleteLibraryDocument(id: number): Promise<void> {
  const doc = await getLibraryDocument(id);
  if (!doc) return;
  const { env } = getCloudflareContext();
  await env.PRODUCT_IMAGES.delete(doc.fileKey).catch(() => {});
  await db().prepare("DELETE FROM library_documents WHERE id = ?").bind(id).run();
}
