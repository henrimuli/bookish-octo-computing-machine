# DebutYard

> Launch, get listed, see proof.

DebutYard is a launch directory for SaaS and startup products. It has:

- weekly debuts with community voting and Debut of the Week/Month/Year winners
- a free tier where your listing link is dofollow while our badge stays on your site
- paid launch tiers and featured placements
- a done-for-you service that submits your product to other directories, with a live tracking dashboard and ongoing link monitoring

The research, pricing and roadmap are in [docs/PLAN.md](docs/PLAN.md).

## Status

**Phase 0 (foundations) is done.**

| Area     | What's there                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App      | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4, the DebutYard design tokens and UI primitives                                                                                                     |
| Database | Supabase Postgres via Drizzle ORM. Migrations in `drizzle/`, including row-level security on every table                                                                                                              |
| Auth     | Better Auth: email magic link, plus Google and GitHub when their keys are set                                                                                                                                         |
| Payments | Paystack (primary) and PayPal behind one `PaymentProvider` interface. One-time checkout, server-side verification, signed webhooks, idempotent processing, refunds, coupons, subscriptions and nightly reconciliation |
| Storage  | Cloudflare R2 helpers (presigned uploads)                                                                                                                                                                             |
| Pages    | Home, pricing, sign-in, checkout return/cancel, terms, privacy, refund policy (with the money-back guarantee)                                                                                                         |
| CI       | Format, lint, typecheck, migration drift check, unit and Postgres integration tests, and build                                                                                                                        |

**What can be bought today:** only the three directory-submission packages ($99 / $179 / $299), because they're delivered by hand. After payment, the buyer gets an email saying we'll collect their product details within 24 hours, and you get an order notification at `ADMIN_EMAIL`. Launch tiers, featured slots and plans show "Opening soon" until their features ship (Phases 1–4).

## Local development

Requirements: Node 20.9+ (22 recommended), pnpm 10, and a Postgres database (a free Supabase project, or local Postgres).

```bash
pnpm install
cp .env.example .env.local   # fill in at least DATABASE_URL, DIRECT_DATABASE_URL, BETTER_AUTH_SECRET
pnpm db:migrate              # apply migrations
pnpm dev                     # http://localhost:3000
```

Without `RESEND_API_KEY`, sign-in links and order emails are printed to the terminal in development. In production, sending fails loudly instead.

### Scripts

| Command                                      | Does                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`               | Next.js                                                                                                   |
| `pnpm lint`, `pnpm typecheck`, `pnpm format` | Code quality                                                                                              |
| `pnpm test`                                  | Unit tests. Set `TEST_DATABASE_URL` to also run the Postgres integration tests (that database gets wiped) |
| `pnpm db:generate`                           | Create a migration after editing `src/db/schema/*`                                                        |
| `pnpm db:migrate`                            | Apply migrations (uses `DIRECT_DATABASE_URL`)                                                             |
| `pnpm db:studio`                             | Browse the database                                                                                       |
| `pnpm payments:sync-plans`                   | Create the subscription plans on Paystack/PayPal and store their ids                                      |

## Setting up the services

### Supabase (database)

1. Create a project. Pick the region closest to your Vercel region, e.g. `eu-central-1` for Frankfurt.
2. Go to **Project Settings → Database → Connection string**:
   - `DATABASE_URL` = **Transaction pooler** (port 6543). The app turns off prepared statements for it.
   - `DIRECT_DATABASE_URL` = **Session pooler** or direct connection (port 5432), used for migrations.
3. Run `pnpm db:migrate`. Every table gets row-level security with no policies. That blocks Supabase's public Data API, and the app is unaffected because it connects as the `postgres` role. A test fails if a new table misses RLS.

### Paystack (primary payments)

1. Create the business account and complete verification. Then **Settings → Preferences**: turn on **international payments** and **USD**. Settlement needs a USD account at a Kenyan bank.
2. **Settings → API Keys & Webhooks**: copy the secret key into `PAYSTACK_SECRET_KEY`. Use `sk_test_…` until you go live.
3. Webhook URL: `https://debutyard.com/api/webhooks/paystack`.
4. Before selling subscriptions, confirm with Paystack that recurring plans can be priced in **USD** on a Kenyan account (PLAN.md §7.5).

### PayPal (second checkout button)

1. Go to [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials** and create an app (sandbox first). Copy its client ID and secret.
2. Add a webhook to `https://debutyard.com/api/webhooks/paypal` with these events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, and the `BILLING.SUBSCRIPTION.*` events. Copy its id into `PAYPAL_WEBHOOK_ID`.
3. Set `PAYPAL_ENV=live` with live credentials when you go live.

After either provider is configured, run `pnpm payments:sync-plans` once per environment.

### Cloudflare R2 (file storage)

1. Create a bucket (e.g. `debutyard`) and connect a custom domain (e.g. `cdn.debutyard.com`) as `R2_PUBLIC_URL`.
2. Create an API token with **Object Read & Write** on that bucket and set the `R2_*` variables.
3. Add a CORS rule allowing `PUT` from your site's origin. Browsers upload straight to R2 with presigned URLs.

### Resend (email)

Verify `debutyard.com` in Resend, then set `RESEND_API_KEY`, `EMAIL_FROM` and `ADMIN_EMAIL`.

### Vercel (hosting)

1. Import the GitHub repo. The framework preset is Next.js and needs no build settings.
2. Add every variable from `.env.example` under **Settings → Environment Variables** (Production and Preview), with `NEXT_PUBLIC_SITE_URL=https://debutyard.com`.
3. Add the domain. Pages like `/pricing` are prerendered, so **redeploy after changing payment keys**.
4. `vercel.json` schedules `/api/cron/reconcile-payments` daily, which the Hobby plan allows. On Pro, change it to hourly. Vercel sends `CRON_SECRET` automatically.

## How payments flow

1. `POST /api/checkout` prices the SKU (`src/lib/payments/skus.ts`), applies any coupon, creates a `pending` order and returns the provider's checkout URL.
2. After paying, the buyer lands on `/checkout/return`. That page confirms with the provider server-side, and captures the order for PayPal. Fulfilment never runs on the redirect alone.
3. Webhooks (`/api/webhooks/{paystack,paypal}`) are signature-checked and stored in `payment_events`, so a re-delivered event is processed once. Payment events are re-verified with the provider before anything changes.
4. Paid orders run the fulfilment handler for their kind (`src/lib/payments/handlers.ts`). A claim on `fulfilled_at` keeps the return page and the webhook from both fulfilling, and a failed handler is retried by the next webhook or the nightly reconcile job.
5. `refundOrder()` handles full and partial refunds (money-back guarantee).

## Project layout

```
src/
  app/                 routes (pages, API routes, webhooks, cron)
  components/          UI primitives and site chrome
  config/site.ts       name, support email, legal entity
  db/                  Drizzle client and schema
  lib/auth.ts          Better Auth server config (auth-client.ts for the browser)
  lib/payments/        SKUs, pricing, providers, service, fulfilment
  lib/storage.ts       Cloudflare R2
  env.ts               environment validation
drizzle/               SQL migrations
scripts/               one-off scripts (plan sync)
tests/                 integration tests
docs/PLAN.md           research and roadmap
```

## Before going live

- Register the business, get the KRA PIN, open the USD bank account, and finish Paystack verification and the PayPal Business account.
- Set `legalName` in `src/config/site.ts` to the registered business name, and have the policy pages reviewed (they're sound drafts, not legal advice).
- Ask an accountant how VAT applies to exported digital services and advertising.
- Make a real low-value purchase with each provider and refund it.
