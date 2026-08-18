/**
 * Transactional email via Brevo.
 *
 * A plain REST call rather than the SDK: the SDK targets Node and pulls in
 * more than a Worker needs, while the endpoint is one POST.
 *
 * Deliberately the only place that knows which provider is in use. Everything
 * upstream calls sendEmail() — swapping to Cloudflare Email Sending later is a
 * change to this file alone.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface EmailEnv {
  /** Brevo API key. Set with `wrangler secret put BREVO_API_KEY`. */
  BREVO_API_KEY?: string;
  /** Verified sender on the Brevo account, e.g. tenders@skrubbit.co.za */
  BREVO_SENDER?: string;
  BREVO_SENDER_NAME?: string;
}

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  detail: string;
}

/** Whether email is configured at all, so callers can fail quietly. */
export function emailConfigured(env: EmailEnv): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER);
}

/**
 * Sends one message.
 *
 * Never throws: a reminder failing to send must not take down the cron run or
 * lose the reminders queued behind it. The reason comes back in `detail` and is
 * recorded against the reminder, so a silent failure is still diagnosable.
 */
export async function sendEmail(env: EmailEnv, message: Message): Promise<SendResult> {
  if (!emailConfigured(env)) {
    return { ok: false, detail: "BREVO_API_KEY or BREVO_SENDER is not set" };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY!,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: env.BREVO_SENDER,
          name: env.BREVO_SENDER_NAME || "Skrubb-it Tenders",
        },
        to: [{ email: message.to }],
        subject: message.subject.slice(0, 200),
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      // Brevo returns a JSON body with a code and message; keep it, trimmed.
      const body = await res.text().catch(() => "");
      return { ok: false, detail: `Brevo ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true, detail: "" };
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 300) };
  }
}
