/**
 * The debut modal opens checkout in a new tab. When the provider sends that
 * tab back (to /checkout/return or /checkout/cancelled), it posts here so the
 * modal can update without waiting for its next poll.
 */
export const CHECKOUT_CHANNEL = "debutyard:checkout";

export type CheckoutMessage = { orderId: string; status: "paid" | "failed" | "pending" | "cancelled" };
