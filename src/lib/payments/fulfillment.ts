import "server-only";
import type { schema } from "@/db";

type Order = typeof schema.orders.$inferSelect;
type Handler = (order: Order) => Promise<void>;

/**
 * What happens after an order is paid, per order kind. Phase 0 ships the
 * plumbing only: each feature phase registers its handler (e.g. Phase 1
 * schedules the launch, Phase 3 opens a submission order).
 */
const handlers = new Map<Order["kind"], Handler>();

export function registerFulfillment(kind: Order["kind"], handler: Handler) {
  handlers.set(kind, handler);
}

/** Runs the handler for the order's kind. Returns false when none is registered yet. */
export async function runFulfillment(order: Order): Promise<boolean> {
  const handler = handlers.get(order.kind);
  if (!handler) return false;
  await handler(order);
  return true;
}
