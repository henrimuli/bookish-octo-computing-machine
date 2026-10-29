import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import {
  COMMENT_BONUS,
  MIN_COMMENT_LENGTH,
  NEW_ACCOUNT_HOURS,
  NEW_ACCOUNT_WEIGHT,
  SAME_IP_WEIGHT,
  APPLAUSE_PER_HOUR,
} from "@/lib/board/ranking";

export const metadata: Metadata = {
  title: "How ranking works",
  description: "How DebutYard ranks each week's debuts, and what paid plans do and don't buy.",
};

export default function HowRankingWorksPage() {
  return (
    <LegalPage title="How ranking works" updated="October 29, 2026">
      <p>
        Every week&apos;s debuts are ranked by the community, using rules we publish here. Paid plans buy{" "}
        <strong>placement</strong> (an instant debut on approval, featured spots, a chosen week, no badge requirement).
        They never buy applause, multipliers or a head start.
      </p>

      <h2>The weekly score</h2>
      <ul>
        <li>Each clap given during the debut week adds its weight (normally 1) to the product&apos;s score.</li>
        <li>
          Each person other than the maker who leaves a substantive comment ({MIN_COMMENT_LENGTH}+ characters) during
          the week adds {COMMENT_BONUS}. Conversation counts, but it can&apos;t outweigh real applause.
        </li>
        <li>Ties go to the product with more total applause, then to the one approved first.</li>
        <li>
          Free debuts start on Monday. Paid debuts go live as soon as they&apos;re approved and join the week in
          progress, so they get fewer days of applause, never extra ones.
        </li>
        <li>
          The week closes on Sunday at 23:59 UTC. The top three become Debut of the Week and keep a followed link
          permanently.
        </li>
      </ul>

      <h2>Keeping it fair</h2>
      <ul>
        <li>
          You need an account to applaud, and you get one clap per product. Changed your mind? Click again to take it
          back.
        </li>
        <li>
          Accounts younger than {NEW_ACCOUNT_HOURS} hours applaud at {NEW_ACCOUNT_WEIGHT * 100}% weight, so mass-created
          accounts don&apos;t move the board.
        </li>
        <li>
          Repeated applause from the same network on the same product counts at {SAME_IP_WEIGHT * 100}% weight. We store
          salted hashes, never raw IP addresses.
        </li>
        <li>Accounts are limited to {APPLAUSE_PER_HOUR} claps an hour.</li>
        <li>
          We review applause patterns every week. Applause we judge to be manipulated is excluded from scores, and
          products involved can be disqualified.
        </li>
      </ul>

      <h2>What&apos;s shown</h2>
      <p>
        The number on each clap button is the plain count of applause. The ranking uses the weighted weekly score above,
        which is why a product with slightly less applause can rank higher.
      </p>
    </LegalPage>
  );
}
