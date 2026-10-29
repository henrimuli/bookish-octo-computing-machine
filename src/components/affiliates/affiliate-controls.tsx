// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".

// "use client";
//
// import Link from "next/link";
// import { useState, useTransition } from "react";
// import { approveReferralAction, markPaidAction, setStatusAction } from "@/app/admin/affiliates/actions";
// import { joinAffiliateAction, updatePayoutEmailAction } from "@/app/dashboard/affiliate/actions";
// import { Button } from "@/components/ui/button";
// import { Input, Label } from "@/components/ui/primitives";
//
// export function JoinAffiliate({ defaultEmail }: { defaultEmail: string }) {
//   const [email, setEmail] = useState(defaultEmail);
//   const [terms, setTerms] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [pending, start] = useTransition();
//   return (
//     <form
//       className="space-y-4"
//       onSubmit={(e) => {
//         e.preventDefault();
//         setError(null);
//         start(async () => {
//           const res = await joinAffiliateAction(email, terms);
//           if (!res.ok) setError(res.error);
//         });
//       }}
//     >
//       <div className="space-y-1.5">
//         <Label htmlFor="payout-email">PayPal email for payouts</Label>
//         <Input
//           id="payout-email"
//           type="email"
//           required
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="max-w-sm"
//         />
//       </div>
//       <label className="flex items-start gap-2 text-sm">
//         <input type="checkbox" className="mt-1" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
//         <span>
//           I agree to the{" "}
//           <Link href="/terms#affiliates" className="text-primary hover:underline">
//             affiliate terms
//           </Link>
//           .
//         </span>
//       </label>
//       <Button type="submit" disabled={pending}>
//         {pending ? "Joining…" : "Get my link"}
//       </Button>
//       {error && <p className="text-sm text-danger">{error}</p>}
//     </form>
//   );
// }
//
// export function CopyLink({ url }: { url: string }) {
//   const [copied, setCopied] = useState(false);
//   return (
//     <div className="flex flex-col gap-2 sm:flex-row">
//       <Input readOnly value={url} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
//       <Button
//         type="button"
//         variant="outline"
//         onClick={async () => {
//           await navigator.clipboard.writeText(url);
//           setCopied(true);
//         }}
//       >
//         {copied ? "Copied" : "Copy"}
//       </Button>
//     </div>
//   );
// }
//
// export function PayoutEmail({ current }: { current: string }) {
//   const [email, setEmail] = useState(current);
//   const [message, setMessage] = useState<string | null>(null);
//   const [pending, start] = useTransition();
//   return (
//     <form
//       className="flex flex-col gap-2 sm:flex-row sm:items-end"
//       onSubmit={(e) => {
//         e.preventDefault();
//         setMessage(null);
//         start(async () => {
//           const res = await updatePayoutEmailAction(email);
//           setMessage(res.ok ? "Saved." : res.error);
//         });
//       }}
//     >
//       <div className="flex-1 space-y-1.5">
//         <Label htmlFor="payout">PayPal payout email</Label>
//         <Input id="payout" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
//       </div>
//       <Button type="submit" variant="outline" disabled={pending}>
//         Save
//       </Button>
//       {message && <p className="text-sm text-muted-foreground sm:self-center">{message}</p>}
//     </form>
//   );
// }
//
// type AdminResult = { ok: true; message?: string } | { ok: false; error: string };
//
// function useAdminAction() {
//   const [message, setMessage] = useState<string | null>(null);
//   const [pending, start] = useTransition();
//   const run = (fn: () => Promise<AdminResult>) =>
//     start(async () => {
//       const res = await fn();
//       setMessage(res.ok ? (res.message ?? null) : res.error);
//     });
//   return { message, pending, run };
// }
//
// export function ApproveReferral({ id }: { id: string }) {
//   const { message, pending, run } = useAdminAction();
//   return (
//     <span>
//       <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => approveReferralAction(id))}>
//         Approve
//       </Button>
//       {message && <span className="ml-2 text-xs text-danger">{message}</span>}
//     </span>
//   );
// }
//
// export function AffiliateAdminActions({
//   id,
//   status,
//   owedCents,
// }: {
//   id: string;
//   status: "active" | "suspended";
//   owedCents: number;
// }) {
//   const { message, pending, run } = useAdminAction();
//   const owed = (owedCents / 100).toFixed(2);
//   return (
//     <div className="flex flex-wrap items-center gap-2">
//       {owedCents > 0 && (
//         <Button
//           size="sm"
//           disabled={pending}
//           onClick={() => {
//             if (!confirm("Mark $" + owed + " as paid? Do this after sending the PayPal payout.")) return;
//             run(() => markPaidAction(id));
//           }}
//         >
//           Mark paid
//         </Button>
//       )}
//       <Button
//         size="sm"
//         variant="outline"
//         disabled={pending}
//         onClick={() => run(() => setStatusAction(id, status === "active" ? "suspended" : "active"))}
//       >
//         {status === "active" ? "Suspend" : "Reactivate"}
//       </Button>
//       {message && <span className="text-xs text-muted-foreground">{message}</span>}
//     </div>
//   );
// }

export {};
