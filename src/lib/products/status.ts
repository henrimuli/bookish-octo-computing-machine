/** How a listing's status reads in the dashboard. */
export const statusTone = {
  draft: "default",
  pending: "accent",
  approved: "success",
  rejected: "primary",
  archived: "default",
} as const;

export const statusLabel = {
  draft: "Draft",
  pending: "In review",
  approved: "Approved",
  rejected: "Not approved",
  archived: "Archived",
} as const;
