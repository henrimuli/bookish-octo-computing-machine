import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import {
  COMMENT_BONUS,
  MIN_COMMENT_LENGTH,
  NEW_ACCOUNT_HOURS,
  NEW_ACCOUNT_WEIGHT,
  SAME_IP_WEIGHT,
  VOTES_PER_HOUR,
} from "@/lib/board/ranking";

export const metadata: Metadata = {
  title: "How ranking works",
  description: "How DebutYard ranks each week's debuts, and what paid plans do and don't buy.",
};

export default function HowRankingWorksPage() {
  return (
    <LegalPage title="How ranking works" updated="October 26, 2026">
      <p>
        Every week&apos;s debuts are ranked by the community, using rules we publish here. Paid plans buy{" "}
        <strong>placement</strong> (featured spots, a chosen week, no badge requirement). They never buy votes, vote
        multipliers or a head start.
      </p>

      <h2>The weekly score</h2>
      <ul>
        <li>Each vote cast during the debut week adds its weight (normally 1) to the product&apos;s score.</li>
        <li>
          Each person other than the maker who leaves a substantive comment ({MIN_COMMENT_LENGTH}+ characters) during
          the week adds {COMMENT_BONUS}. Conversation counts, but it can&apos;t outweigh real votes.
        </li>
        <li>Ties go to the product with more total votes, then to the one approved first.</li>
        <li>
          The week closes on Sunday at 23:59 UTC. The top three become Debut of the Week and keep a followed link
          permanently.
        </li>
      </ul>

      <h2>Keeping it fair</h2>
      <ul>
        <li>You need an account to vote, and you get one vote per product.</li>
        <li>
          Accounts younger than {NEW_ACCOUNT_HOURS} hours vote at {NEW_ACCOUNT_WEIGHT * 100}% weight, so mass-created
          accounts don&apos;t move the board.
        </li>
        <li>
          Repeated votes from the same network on the same product count at {SAME_IP_WEIGHT * 100}% weight. We store
          salted hashes, never raw IP addresses.
        </li>
        <li>Accounts are limited to {VOTES_PER_HOUR} votes an hour.</li>
        <li>
          We review vote patterns every week. Votes we judge to be manipulated are excluded from scores, and products
          involved can be disqualified.
        </li>
      </ul>

      <h2>What&apos;s shown</h2>
      <p>
        The number on each vote button is the plain count of votes. The ranking uses the weighted weekly score above,
        which is why a product with slightly fewer votes can rank higher.
      </p>
    </LegalPage>
  );
}
