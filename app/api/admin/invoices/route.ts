import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireAdmin } from "@/lib/admin-auth";
import { getCompanyProfile } from "@/lib/company";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { validateCustomer, validateDraft, validatePayment } from "@/lib/invoice-validation";
import {
  addPayment,
  createCustomer,
  createDraft,
  deleteCustomer,
  deleteDraft,
  deletePayment,
  getCustomer,
  getInvoice,
  invoiceFromQuote,
  issueDraft,
  markEmailed,
  updateCustomer,
  updateDraft,
  voidInvoice,
} from "@/lib/invoices";
import { emailConfigured, parseRecipients, sendEmail } from "@/lib/notify";
import { getPricing, sastToday } from "@/lib/tenders";

export const dynamic = "force-dynamic";

/**
 * Everything the invoices screen does, behind one route.
 *
 * The screen loads once and then talks only to this endpoint, and every
 * answer is the one record that changed — never the whole list — so working
 * through a month's invoices costs a request per action, not a page load.
 *
 *   GET  ?id=N          one document with its lines and payments
 *   GET  ?id=N&pdf=1    that document as a PDF
 *   GET  ?tender=N      a tender's pricing lines, to bill from
 *   POST { action, … }  see the switch below
 */

const bad = (error: string, status = 400) => Response.json({ error }, { status });
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** The letterhead logo is a static asset, so it is fetched, not bundled. */
async function fetchLogo(base: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(new URL("/images/brand/logo-letterhead.png", base), {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
  } catch {
    // The letterhead still sets without it.
  }
  return undefined;
}

function fileName(kind: string, number: string | null): string {
  return `${kind === "quote" ? "quote" : "invoice"}-${(number ?? "draft").toLowerCase()}.pdf`;
}

export async function GET(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const url = new URL(req.url);

  const tenderId = num(url.searchParams.get("tender"));
  if (tenderId) {
    const lines = await getPricing(tenderId);
    return Response.json({
      lines: lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });
  }

  const id = num(url.searchParams.get("id"));
  if (!id) return bad("Missing id");
  const invoice = await getInvoice(id);
  if (!invoice) return bad("Not found", 404);

  if (url.searchParams.get("pdf")) {
    const [profile, logo] = await Promise.all([getCompanyProfile(), fetchLogo(req.url)]);
    const pdf = await buildInvoicePdf({ profile, invoice, logo });
    return new Response(pdf as BodyInit, {
      headers: {
        "content-type": "application/pdf",
        // Inline, so it opens in the browser's viewer to check before sending.
        "content-disposition": `inline; filename="${fileName(invoice.kind, invoice.number)}"`,
        "cache-control": "no-store",
      },
    });
  }

  return Response.json({ invoice });
}

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON");
  }

  const id = num(body.id);

  switch (body.action) {
    /* ------------------------------ customers ----------------------------- */

    case "saveCustomer": {
      const result = validateCustomer(body);
      if ("errors" in result) return bad(result.errors.join(" "));
      const customerId = id ?? (await createCustomer(result.value));
      if (id) await updateCustomer(id, result.value);
      return Response.json({ customer: await getCustomer(customerId) });
    }

    case "deleteCustomer": {
      if (!id) return bad("Missing id");
      if (!(await deleteCustomer(id))) {
        return bad("This customer has quotes or invoices, so they are kept.", 409);
      }
      return Response.json({ ok: true });
    }

    /* ------------------------------- drafts ------------------------------ */

    case "saveDraft": {
      const result = validateDraft(body);
      if ("errors" in result) return bad(result.errors.join(" "));
      const { vatRegistered } = await getCompanyProfile();
      let invoiceId = id;
      if (invoiceId) {
        if (!(await updateDraft(invoiceId, result.value, vatRegistered))) {
          return bad("Only a draft can be edited.", 409);
        }
      } else {
        invoiceId = await createDraft(result.value, vatRegistered);
        if (!invoiceId) return bad("That customer no longer exists.");
      }
      return Response.json({ invoice: await getInvoice(invoiceId) });
    }

    case "deleteDraft": {
      if (!id) return bad("Missing id");
      if (!(await deleteDraft(id)))
        return bad("Only a draft can be deleted. Void it instead.", 409);
      return Response.json({ ok: true });
    }

    /* ------------------------------ lifecycle ---------------------------- */

    case "issue": {
      if (!id) return bad("Missing id");
      const { vatRegistered } = await getCompanyProfile();
      const result = await issueDraft(id, sastToday(), vatRegistered);
      if (!result.ok) return bad(result.error, 409);
      return Response.json({ invoice: await getInvoice(id) });
    }

    case "void": {
      if (!id) return bad("Missing id");
      if (!(await voidInvoice(id))) return bad("Only an issued document can be voided.", 409);
      return Response.json({ invoice: await getInvoice(id) });
    }

    case "convert": {
      if (!id) return bad("Missing id");
      const { vatRegistered } = await getCompanyProfile();
      const invoiceId = await invoiceFromQuote(id, vatRegistered);
      if (!invoiceId) return bad("Only an issued quote can be invoiced.", 409);
      return Response.json({ invoice: await getInvoice(invoiceId), quote: await getInvoice(id) });
    }

    /* ------------------------------ payments ----------------------------- */

    case "addPayment": {
      if (!id) return bad("Missing id");
      const result = validatePayment(body);
      if ("errors" in result) return bad(result.errors.join(" "));
      if (!(await addPayment(id, result.value))) {
        return bad("Payments can only be recorded against an issued invoice.", 409);
      }
      return Response.json({ invoice: await getInvoice(id) });
    }

    case "deletePayment": {
      const paymentId = num(body.paymentId);
      if (!id || !paymentId) return bad("Missing id");
      await deletePayment(id, paymentId);
      return Response.json({ invoice: await getInvoice(id) });
    }

    /* -------------------------------- email ------------------------------ */

    case "email": {
      if (!id) return bad("Missing id");
      if (!emailConfigured(env))
        return bad("Email is not set up (BREVO_API_KEY / BREVO_SENDER).", 503);

      const invoice = await getInvoice(id);
      if (!invoice) return bad("Not found", 404);
      if (invoice.status !== "issued") return bad("Issue it before sending it.", 409);

      const to = parseRecipients(typeof body.to === "string" ? body.to : invoice.customerEmail);
      if (!to.length) return bad("Enter an email address to send it to.");

      const [profile, logo] = await Promise.all([getCompanyProfile(), fetchLogo(req.url)]);
      const pdf = await buildInvoicePdf({ profile, invoice, logo });

      const company = profile.tradingName || profile.legalName || "Skrubb-it";
      const what = invoice.kind === "quote" ? "Quotation" : "Invoice";
      const note = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
      const lines = [
        `Good day${invoice.customerContact ? ` ${invoice.customerContact}` : ""},`,
        "",
        note ||
          (invoice.kind === "quote"
            ? `Please find our quotation ${invoice.number} attached, valid until ${invoice.dueOn}.`
            : `Please find invoice ${invoice.number} attached, due on ${invoice.dueOn}. Kindly use ${invoice.number} as the payment reference.`),
        "",
        "Kind regards,",
        profile.signatoryName || company,
        company,
        profile.phone,
      ].filter((l) => l !== undefined);

      const escape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const sent = await sendEmail(env, {
        to,
        subject: `${what} ${invoice.number} from ${company}`,
        text: lines.join("\n"),
        html: lines.map((l) => (l ? `<p style="margin:0">${escape(l)}</p>` : "<br>")).join(""),
        senderName: company,
        replyTo: parseRecipients(profile.email)[0],
        attachments: [{ name: fileName(invoice.kind, invoice.number), content: pdf }],
      });
      if (!sent.ok) return bad(`Not sent: ${sent.detail}`, 502);

      await markEmailed(id, to.join(", "));
      return Response.json({ invoice: await getInvoice(id) });
    }

    default:
      return bad("Unknown action");
  }
}
