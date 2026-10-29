// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".
// Was /dashboard/affiliate. The _ folder keeps it out of routing; rename it back to restore.

// import type { Metadata } from "next";
// import { Suspense } from "react";
// import { CopyLink, JoinAffiliate, PayoutEmail } from "@/components/affiliates/affiliate-controls";
// import { Badge, Card, Heading } from "@/components/ui/primitives";
// import { env } from "@/env";
// import { APPROVE_AFTER_DAYS, DEFAULT_RATE_PCT, VIA_DAYS } from "@/lib/affiliates/rules";
// import { affiliateFor, referralsFor } from "@/lib/affiliates/service";
// import { requireUser } from "@/lib/auth";
// import { formatUsd, getSku } from "@/lib/payments/skus";
//
// export const metadata: Metadata = { title: "Affiliate program", robots: { index: false } };
//
// const day = (d: Date | null) =>
//   d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";
//
// const STATUS = {
//   pending: { label: "Pending", tone: "default" },
//   approved: { label: "Approved", tone: "accent" },
//   paid: { label: "Paid", tone: "success" },
//   void: { label: "Refunded", tone: "default" },
// } as const;
//
// export default function AffiliatePage() {
//   return (
//     <div className="mx-auto max-w-4xl">
//       <Heading className="text-2xl sm:text-3xl">Affiliate program</Heading>
//       <p className="mt-2 text-muted-foreground">
//         Earn {DEFAULT_RATE_PCT}% of every submission package or paid debut bought within {VIA_DAYS} days of someone
//         clicking your link.
//       </p>
//       <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-lg bg-muted/50" />}>
//         <Affiliate />
//       </Suspense>
//     </div>
//   );
// }
//
// async function Affiliate() {
//   const user = await requireUser("/dashboard/affiliate");
//   const aff = await affiliateFor(user.id);
//   if (!aff) {
//     return (
//       <Card className="mt-8">
//         <h2 className="font-display text-lg font-semibold">Join</h2>
//         <p className="mt-1 mb-4 text-sm text-muted-foreground">
//           You get a link to share. Commissions are approved {APPROVE_AFTER_DAYS} days after payment and paid by PayPal.
//         </p>
//         <JoinAffiliate defaultEmail={user.email} />
//       </Card>
//     );
//   }
//
//   const { rows, stats } = await referralsFor(aff.id);
//   const link = new URL(`/?via=${aff.code}`, env().NEXT_PUBLIC_SITE_URL).toString();
//   const tiles = [
//     { label: "Referrals", value: String(stats.referrals) },
//     { label: "Pending", value: formatUsd(stats.pendingCents) },
//     { label: "Approved, unpaid", value: formatUsd(stats.approvedCents) },
//     { label: "Paid out", value: formatUsd(stats.paidCents) },
//   ];
//
//   return (
//     <div className="mt-8 space-y-6">
//       {aff.status === "suspended" && (
//         <Card className="text-sm">
//           Your affiliate account is suspended, so new referrals don&apos;t earn commission. Email us if you think this
//           is a mistake.
//         </Card>
//       )}
//       <Card className="space-y-3">
//         <h2 className="font-display text-lg font-semibold">Your link</h2>
//         <CopyLink url={link} />
//         <p className="text-sm text-muted-foreground">
//           Or add <code>?via={aff.code}</code> to any DebutYard page, like{" "}
//           <code>/submission-service?via={aff.code}</code>.
//         </p>
//       </Card>
//
//       <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
//         {tiles.map((t) => (
//           <Card key={t.label} className="p-4">
//             <p className="text-xs text-muted-foreground">{t.label}</p>
//             <p className="mt-1 font-display text-xl font-semibold tabular-nums">{t.value}</p>
//           </Card>
//         ))}
//       </div>
//
//       <Card>
//         <h2 className="font-display text-lg font-semibold">Referrals</h2>
//         {rows.length === 0 ? (
//           <p className="mt-2 text-sm text-muted-foreground">None yet. Share your link to get started.</p>
//         ) : (
//           <ul className="mt-3 divide-y divide-border text-sm">
//             {rows.map(({ r, sku, paidAt }) => (
//               <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
//                 <span className="min-w-0">
//                   {getSku(sku)?.name ?? sku}
//                   <span className="ml-2 text-muted-foreground">{day(paidAt)}</span>
//                 </span>
//                 <span className="flex items-center gap-2">
//                   <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
//                   <span className="tabular-nums">{formatUsd(r.commissionCents)}</span>
//                 </span>
//               </li>
//             ))}
//           </ul>
//         )}
//       </Card>
//
//       <Card>
//         <PayoutEmail current={aff.payoutEmail} />
//       </Card>
//     </div>
//   );
// }

export {};
