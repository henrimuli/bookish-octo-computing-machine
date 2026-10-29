# Affiliates are paused

The affiliate program is switched off, not deleted. Nothing user-facing mentions it, no `?via=` cookie is set, no commission is recorded, and the daily job doesn't approve any. The `affiliates` and `affiliate_referrals` tables stay in the schema (`src/db/schema/affiliates.ts`), so no migration is needed either way. Existing rows are kept as they are.

## To turn it back on

1. Uncomment these files. Each one is fully commented out and ends with `export {};` or a skipped test. Delete those placeholder lines when you restore them.
   - `src/lib/affiliates/cookie.ts`, `rules.ts`, `service.ts`, `rules.test.ts`
   - `src/components/affiliates/affiliate-controls.tsx`
   - `tests/affiliates.integration.test.ts`
2. Move these back so Next routes them again:
   - `src/lib/affiliates/proxy.ts` → `src/proxy.ts`
   - `src/app/dashboard/_affiliate/` → `src/app/dashboard/affiliate/`
   - `src/app/admin/_affiliates/` → `src/app/admin/affiliates/`
3. Uncomment the call sites marked "Affiliates are paused":
   - `src/app/api/checkout/route.ts` and `src/app/submit/actions.ts`: the `via` referral code on orders
   - `src/lib/payments/service.ts`: recording the commission on payment, and adjusting it on refund
   - `src/app/api/cron/daily/route.ts`: the `affiliates` approval task
   - `src/app/dashboard/layout.tsx` and `src/app/admin/layout.tsx`: the nav items
   - `src/app/admin/dashboard/page.tsx` and `src/lib/admin/overview.ts`: commission owed
   - `src/app/(site)/terms/page.tsx`: the Affiliate program section
