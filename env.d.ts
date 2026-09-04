/**
 * Secrets, declared separately from worker-configuration.d.ts.
 *
 * `wrangler types` regenerates that file from wrangler.jsonc and only knows
 * about bindings and plain vars — secrets set with `wrangler secret put` never
 * appear there. Declaring them here merges them into the same interface
 * without risking them being written into a committed config file.
 */

interface CloudflareEnv {
  /**
   * Bootstrap admin credential, used until a password is set through the reset
   * flow — after which the live pair lives in the `admin_credentials` table and
   * these two are inert and can be deleted. A Worker cannot rewrite its own
   * secrets, which is the reason the credential cannot stay here.
   */
  ADMIN_USERNAME?: string;
  /** `pbkdf2$<iterations>$<saltB64>$<hashB64>`, never the password itself. */
  ADMIN_PASSWORD_HASH?: string;
  /** HMAC key used to sign admin session cookies. */
  ADMIN_SESSION_SECRET?: string;
  /** Local-only auth bypass, set in .dev.vars. Never set in production. */
  ADMIN_DISABLE_ACCESS_CHECK?: string;

  /** Turnstile secret for the admin sign-in challenge. Unset means the
   *  challenge is skipped, so the widget and the secret can be configured
   *  separately without locking the admin out in between. */
  TURNSTILE_SECRET_KEY?: string;

  /** Shared secret the cron worker presents to /api/cron/reminders. Unset
   *  means reminders are disabled, not open. */
  CRON_SECRET?: string;
  /** Brevo transactional email. Unset means reminders are skipped quietly. */
  BREVO_API_KEY?: string;
  /** Verified sender on the Brevo account, e.g. tenders@skrubbit.co.za */
  BREVO_SENDER?: string;
  BREVO_SENDER_NAME?: string;
}
