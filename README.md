# Skrubb-it Products

Mobile-first e-commerce site for **Skrubb-it** — a proudly South African,
black woman–owned manufacturer of industrial & household cleaning products and
personal care essentials.

## Stack

- **Next.js 15** (App Router, React 19)
- **Tailwind CSS + shadcn/ui** (new-york style) — mobile-first
- **Zustand** cart (persisted to `localStorage`)
- **Cloudflare Workers** deployment via **`@opennextjs/cloudflare`**
- Checkout model: **cart → WhatsApp / email order enquiry** (no card data on-site)

## Getting started

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Scripts

| Script          | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `pnpm dev`      | Next.js dev server                                      |
| `pnpm build`    | Production Next.js build                                |
| `pnpm preview`  | Build + run on the Cloudflare Workers runtime locally   |
| `pnpm deploy`   | Build + deploy to Cloudflare Workers                    |
| `pnpm typecheck`| `tsc --noEmit`                                          |

## Project structure

```
app/                 # routes (App Router)
  page.tsx           # home
  shop/              # shop listing + [slug] product pages
  checkout/          # WhatsApp order enquiry
  about/ contact/    # info pages
  api/               # route handlers (products, contact, orders)
components/
  ui/                # shadcn/ui primitives
  layout/            # header, footer
  *.tsx              # product-card, cart-sheet, add-to-cart, forms
data/
  products.ts        # ⚠️ product catalogue — SINGLE SOURCE OF TRUTH
  site.ts            # ⚠️ contact details / WhatsApp number
lib/                 # utils, WhatsApp helpers
store/cart.ts        # cart state
public/images/       # brand + product images
```

## ⚠️ Before going live — fill in real values

1. **`data/site.ts`** — WhatsApp number (international format, digits only),
   phone, email, location, socials.
2. **`data/products.ts`** — real **prices** and **SKUs** (current values are
   placeholders), plus any personal-care products.
3. **`app/api/contact` & `app/api/orders`** — wire enquiries to a real
   destination (Cloudflare Email, Resend, or a D1 table). They currently log.
4. Product photography — swap the images in `public/images/products/`.

## Deploying to Cloudflare

```bash
pnpm dlx wrangler login      # once
pnpm deploy
```

Config lives in `wrangler.jsonc` and `open-next.config.ts`. Storage bindings
(D1 / R2 / KV) are stubbed as comments in `wrangler.jsonc` for when we add a
database or image bucket.
