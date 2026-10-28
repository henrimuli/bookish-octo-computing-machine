import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund policy" updated="October 26, 2026">
      <p>
        We want every purchase on {site.name} to be risk-free. This policy explains when you get your money back and how
        to ask for it. Refunds go back to the card or PayPal account you paid with.
      </p>

      <h2>Money-back guarantee on paid debuts</h2>
      <p>You get a full refund on any paid debut (Fast Track, Pro, Premium, Spotlight or Relaunch) if:</p>
      <ul>
        <li>we don&apos;t approve your listing;</li>
        <li>your paid listing isn&apos;t live within 48 hours of approval or of the debut week you chose; or</li>
        <li>the link from your listing to your website isn&apos;t a followed (dofollow) link.</li>
      </ul>

      <h2>Directory submission packages</h2>
      <ul>
        <li>
          Before we start submitting (submissions begin within 48 hours of receiving your product details), you can
          cancel for a full refund.
        </li>
        <li>
          Third-party directories make their own editorial decisions. When one rejects your product or shuts down, we
          replace it with an equivalent directory so you receive the number of submissions you paid for. If we
          can&apos;t, we refund the missing share.
        </li>
        <li>
          If we don&apos;t deliver your report within 14 days of starting, for reasons on our side, you can ask for a
          full refund.
        </li>
      </ul>

      <h2>Featured placements and sponsorships</h2>
      <p>
        You can cancel for a full refund until the placement starts. If your cost per click hasn&apos;t come down to $1
        by the end of the run, the placement stays up for free until it does.
      </p>

      <h2>Subscriptions</h2>
      <p>
        You can cancel at any time and keep access until the end of the period you paid for. If you forgot to cancel,
        write to us within 7 days of a renewal and we&apos;ll refund that renewal.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> with your order reference (it&apos;s in
        your confirmation email). We reply within 2 business days, and approved refunds are sent within 5 business days.
        Your bank or PayPal may take a few more days to show it.
      </p>
    </LegalPage>
  );
}
