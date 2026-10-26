# DebutYard

> Launch, get listed, see proof.

DebutYard is a launch directory for SaaS and startup products. It has:

- weekly debuts with community voting and Debut of the Week/Month/Year winners
- a free tier where your listing link is dofollow while our badge stays on your site
- paid launch tiers and featured placements
- a done-for-you service that submits your product to other directories, with a live tracking dashboard and ongoing link monitoring

The research, pricing and roadmap are in [docs/PLAN.md](docs/PLAN.md).

## Status

**Phase 0 (foundations) and Phase 1 (launch board) are done.**

| Area            | What's there                                                                                                                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch board    | Weekly debuts (Mon–Sun UTC), a ranked board on the homepage, past weeks, categories, builder profiles, product pages (week rank, votes-per-day chart, same-week and similar products, discussion)                                                                                  |
| Submitting      | `/submit`: fill details from the product's URL, logo upload to R2, up to 3 categories, then a plan: free (queue, max 2 waiting per maker) or Fast Track / Pro / Premium / Spotlight through Paystack or PayPal                                                                     |
| Moderation      | `/admin` review queue (paid listings first). Approving schedules the listing; rejecting a paid listing refunds it automatically (money-back guarantee)                                                                                                                             |
| Voting          | One vote per account. New accounts (<72h) and repeat votes from the same network count less. Rate limits. Substantive comments add a little to the score. Rules published at `/how-ranking-works`                                                                                  |
| Winners         | A daily cron closes finished weeks: top 3 (with votes) get awards, a permanent followed link and an email                                                                                                                                                                          |
| Badges          | Light/dark SVG badges (`/badge/{slug}`, winner variant, optional live vote count). Verification by fetching the site (HTML) or a DNS TXT record. Weekly re-check, 7-day grace period, then nofollow                                                                                |
| Featured        | Pro (7 days), Premium and Spotlight (30 days) appear in the homepage featured rail. Spotlight is the hero during its debut week, capped at 3 per week. Manual perks (newsletter, social posts, launch post, Spotlight's directory bundle) arrive as a to-do email to `ADMIN_EMAIL` |
| Maker dashboard | Status, debut week and queue position, badge snippet and one-click check, views, clicks, votes and comments                                                                                                                                                                        |
| SEO             | Sitemap, robots, JSON-LD per product, generated Open Graph images, `llms.txt`                                                                                                                                                                                                      |
| Foundations     | Next.js 16 (Cache Components), Supabase Postgres + Drizzle (RLS on every table), Better Auth magic link + Google/GitHub, Paystack + PayPal behind one `PaymentProvider`, R2, Resend, CI                                                                                            |

**Admin access:** the account whose email matches `ADMIN_EMAIL` becomes an admin when it signs up.

**What can be bought today:**

- paid debuts, during submission;
- the three directory-submission packages ($99 / $179 / $299), delivered by hand: the buyer gets an email saying we'll collect their product details within 24 hours, and you get an order notification.

Standalone featured slots and subscriptions show "Opening soon" until Phases 2–4.

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
| `pnpm db:seed`                               | Fill a local database with sample makers, products, votes and comments (refuses to run in production)     |

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
4. `vercel.json` schedules one daily job, `/api/cron/daily`, at 00:10 UTC, so each week closes just after Monday 00:00. It closes finished weeks and awards winners, reconciles payments, and re-checks badges. The Hobby plan allows this. Vercel sends `CRON_SECRET` automatically.

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
