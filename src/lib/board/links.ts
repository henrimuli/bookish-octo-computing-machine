type LinkInput = {
  tier: string;
  isWinner: boolean;
  badgeStatus: "unverified" | "verified" | "grace" | "missing";
};

/**
 * Whether the listing's link to the maker's site is followed:
 * paid tiers and weekly winners always; free listings while the badge is
 * verified (including the 7-day grace period after it disappears).
 */
export function isFollowed({ tier, isWinner, badgeStatus }: LinkInput): boolean {
  return tier !== "free" || isWinner || badgeStatus === "verified" || badgeStatus === "grace";
}

export function listingRel(input: LinkInput): string {
  return isFollowed(input) ? "noopener" : "nofollow ugc noopener";
}

/** Adds ?ref=debutyard so makers can see us in their analytics. */
export function withRef(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("ref")) u.searchParams.set("ref", "debutyard");
    return u.toString();
  } catch {
    return url;
  }
}
