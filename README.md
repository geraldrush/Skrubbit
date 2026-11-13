# Skrubb-it Products

[![CI](https://github.com/geraldrush/skrubbit/actions/workflows/ci.yml/badge.svg)](https://github.com/geraldrush/skrubbit/actions/workflows/ci.yml)

The website and back-office system of **Skrubb-it**, a South African, black woman–owned
manufacturer of industrial and household cleaning products. Live at
**[skrubbit.co.za](https://skrubbit.co.za)**.

Built and maintained by **BePlugged Tech**.

## What it does

**Public site**

- Mobile-first product catalogue with variants (size, SKU, price), category pages and product
  detail pages with structured data for search engines.
- Cart and checkout that place an order by email. No card data is collected or stored on the
  site; the business confirms stock, delivery and the final price with the customer.
- Contact and quote-request forms, cleaning-services and public-sector pages.

**Admin console** (`/admin`)

- **Orders and enquiries** captured from the site, kept in the database rather than only in
  email.
- **Products**: create and edit the catalogue and its images (stored in R2).
- **Invoices and quotes**: drafts, issuing with sequential numbers, VAT, payments and
  part-payments, overdue and age analysis, quote-to-invoice conversion, PDF generation and
  emailing. An issued invoice is never edited; a mistake is voided and reissued, as an auditor
  expects.
- **Tenders**: a mirror of the National Treasury eTenders feed (OCDS), refreshed daily, with
  search, deadline reminders and new-advert alerts; per-tender pricing, required-document
  checklists and a generated bid pack.
- **Company document library** (registration, tax, B-BBEE and similar) attached to bids.

## Architecture

| Layer      | Technology                                                                           |
| ---------- | ------------------------------------------------------------------------------------ |
| Framework  | Next.js 15 (App Router, React Server Components), React 19, TypeScript (strict)      |
| UI         | Tailwind CSS, shadcn/ui (Radix primitives), Zustand for the cart                     |
| Hosting    | Cloudflare Workers via `@opennextjs/cloudflare`, static assets served at the edge    |
| Data       | Cloudflare D1 (SQLite) with versioned SQL migrations in `migrations/`                |
| Files      | Cloudflare R2 (product images, company documents, tender files)                      |
| Scheduling | A separate cron Worker (`cron/`) that refreshes tenders and triggers reminders       |
| Email      | Brevo transactional API                                                              |
| PDFs       | `pdf-lib` (invoices, quotes, company profile, bid packs)                             |
| Quality    | Vitest, ESLint (`next/core-web-vitals`, `next/typescript`), Prettier, GitHub Actions |

```
Browser ──► Cloudflare edge ──► Worker (Next.js via OpenNext)
                                   ├── D1   orders, enquiries, invoices, tenders, admin auth
                                   ├── R2   images and documents
                                   └── Brevo order, enquiry and reminder emails
Cron Worker (daily) ──► eTenders OCDS API ──► D1  ──► /api/cron/reminders
```

## Security

- **Admin authentication.** Cloudflare Access JWTs are verified cryptographically (RS256
  against the team's JWKS, audience, issuer and expiry). A password sign-in is available as a
  fallback: PBKDF2-hashed credentials, constant-time comparison, HMAC-signed `HttpOnly`,
  `Secure`, `SameSite=Lax` session cookies, a per-IP lockout after failed attempts, Turnstile
  on the form, and every session invalidated when the password changes. Misconfiguration fails
  closed: with no credential set, nobody is an admin.
- **Authorisation.** Every `/api/admin/*` route checks the session; only sign-in, sign-out
  and password reset are open. Cron endpoints require a shared secret.
- **Public forms.** Orders and contact messages are rate-limited per IP at the edge and
  verified with Cloudflare Turnstile before anything is stored or emailed
  (`lib/form-guard.ts`). All input is length-capped, and order totals are recomputed on the
  server rather than trusted from the browser.
- **Data access.** All SQL uses bound parameters. Customer details are kept out of logs.
- **HTTP headers.** Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`,
  Referrer-Policy, Permissions-Policy and COOP on every response (`next.config.mjs`).
- **Dependencies.** CI fails on any high or critical advisory in production dependencies.

## Quality checks

```bash
pnpm typecheck      # TypeScript, strict mode
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm test           # Vitest unit tests
```

The tests in `tests/` cover the rules that carry money or access: order normalisation and
totals, invoice rounding and VAT, invoice and quote states, request validation, password
hashing, session tokens and the admin guard, and the public-form guard. CI
(`.github/workflows/ci.yml`) runs all of the above plus a dependency audit and the full
Cloudflare build on every push and pull request.

## Running locally

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm preview        # build and run on the Workers runtime locally
```

Local secrets go in `.dev.vars` (never committed). Production secrets are set with
`wrangler secret put`:

| Secret                                  | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` | Bootstrap admin credential (hash, never the password) |
| `ADMIN_SESSION_SECRET`                  | Signs admin session cookies                           |
| `TURNSTILE_SECRET_KEY`                  | Server-side Turnstile verification                    |
| `CRON_SECRET`                           | Authenticates the cron Worker                         |
| `BREVO_API_KEY`, `BREVO_SENDER`         | Transactional email                                   |

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read at build time to show the Turnstile widget.

## Project structure

```
app/                  routes: public pages, /admin console, /api route handlers
components/           UI; components/admin for the console, components/ui for shadcn/ui
lib/                  domain logic: auth, invoices, tenders, validation, PDFs, email
data/                 product catalogue and site details
migrations/           D1 schema, applied in order
cron/                 scheduled Worker for the daily tender refresh and reminders
tests/                Vitest unit tests
```

## Deployment

```bash
pnpm deploy                                         # build and deploy the site
pnpm dlx wrangler d1 migrations apply skrubbit --remote   # apply new migrations
```

Configuration is in `wrangler.jsonc` (bindings, routes, rate limits) and
`open-next.config.ts`.

## Licence

Proprietary. Published for review only; see [LICENSE](LICENSE).
