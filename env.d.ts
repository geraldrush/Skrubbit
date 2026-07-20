/**
 * Secrets, declared separately from worker-configuration.d.ts.
 *
 * `wrangler types` regenerates that file from wrangler.jsonc and only knows
 * about bindings and plain vars — secrets set with `wrangler secret put` never
 * appear there. Declaring them here merges them into the same interface
 * without risking them being written into a committed config file.
 */

interface CloudflareEnv {
  /** Interim admin password, until Cloudflare Access fronts /admin. */
  ADMIN_PASSWORD?: string;
  /** HMAC key used to sign admin session cookies. */
  ADMIN_SESSION_SECRET?: string;
  /** Local-only auth bypass, set in .dev.vars. Never set in production. */
  ADMIN_DISABLE_ACCESS_CHECK?: string;
}
