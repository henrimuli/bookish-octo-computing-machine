// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".
// Was /admin/affiliates. The _ folder keeps it out of routing; rename it back to restore.

// import type { Metadata } from "next";
// import { Suspense } from "react";
// import { AffiliateAdminActions, ApproveReferral } from "@/components/affiliates/affiliate-controls";
// import { Badge, Heading } from "@/components/ui/primitives";
// import { APPROVE_AFTER_DAYS } from "@/lib/affiliates/rules";
// import { listAffiliates, listReferrals } from "@/lib/affiliates/service";
// import { requireStaff } from "@/lib/auth";
// import { formatUsd } from "@/lib/payments/skus";
//
// export const metadata: Metadata = { title: "Affiliates · Admin", robots: { index: false } };
//
// const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
//
// export default function AffiliatesAdminPage() {
//   return (
//     <div className="mx-auto max-w-6xl">
//       <Heading className="text-2xl sm:text-3xl">Affiliates</Heading>
//       <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
//         <Body />
//       </Suspense>
//     </div>
//   );
// }
//
// async function Body() {
//   await requireStaff();
//   const [affs, refs] = await Promise.all([listAffiliates(), listReferrals()]);
//   return (
//     <div className="mt-8 space-y-10">
//       <section>
//         <h2 className="font-display text-xl font-semibold">Payouts</h2>
//         <p className="mt-1 text-sm text-muted-foreground">
//           Send the owed amount by PayPal to the payout email, then mark it paid. Pending commissions approve themselves{" "}
//           {APPROVE_AFTER_DAYS} days after payment.
//         </p>
//         {affs.length === 0 ? (
//           <p className="mt-3 text-sm text-muted-foreground">No affiliates yet.</p>
//         ) : (
//           <div className="mt-3 overflow-x-auto rounded-lg border border-border">
//             <table className="w-full text-sm">
//               <thead className="bg-muted/50 text-xs text-muted-foreground">
//                 <tr>
//                   <th className="px-3 py-2 text-left font-medium">Affiliate</th>
//                   <th className="px-3 py-2 text-left font-medium">PayPal</th>
//                   <th className="px-3 py-2 text-right font-medium">Pending</th>
//                   <th className="px-3 py-2 text-right font-medium">Owed</th>
//                   <th className="px-3 py-2 text-right font-medium">Paid</th>
//                   <th className="px-3 py-2" />
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-border">
//                 {affs.map((x) => (
//                   <tr key={x.a.id}>
//                     <td className="px-3 py-2">
//                       <div className="font-medium">
//                         {x.name} {x.a.status === "suspended" && <Badge>suspended</Badge>}
//                       </div>
//                       <div className="text-xs text-muted-foreground">
//                         {x.a.code} · {x.email}
//                       </div>
//                     </td>
//                     <td className="px-3 py-2 break-all">{x.a.payoutEmail}</td>
//                     <td className="px-3 py-2 text-right tabular-nums">{formatUsd(x.pendingCents)}</td>
//                     <td className="px-3 py-2 text-right font-medium tabular-nums">{formatUsd(x.owedCents)}</td>
//                     <td className="px-3 py-2 text-right tabular-nums">{formatUsd(x.paidCents)}</td>
//                     <td className="px-3 py-2">
//                       <AffiliateAdminActions id={x.a.id} status={x.a.status} owedCents={x.owedCents} />
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </section>
//
//       <section>
//         <h2 className="font-display text-xl font-semibold">Recent referrals</h2>
//         {refs.length === 0 ? (
//           <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
//         ) : (
//           <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
//             {refs.map((x) => (
//               <li key={x.r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
//                 <span>
//                   <span className="font-medium">{x.code}</span> · {x.sku} · {formatUsd(x.amountCents)}
//                   <span className="ml-2 text-muted-foreground">{day(x.r.createdAt)}</span>
//                 </span>
//                 <span className="flex items-center gap-2">
//                   <Badge>{x.r.status}</Badge>
//                   <span className="tabular-nums">{formatUsd(x.r.commissionCents)}</span>
//                   {x.r.status === "pending" && <ApproveReferral id={x.r.id} />}
//                 </span>
//               </li>
//             ))}
//           </ul>
//         )}
//       </section>
//     </div>
//   );
// }

export {};
