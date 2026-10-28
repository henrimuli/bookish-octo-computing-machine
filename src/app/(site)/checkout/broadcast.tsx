"use client";

import { useEffect } from "react";
import { CHECKOUT_CHANNEL, type CheckoutMessage } from "@/lib/checkout-channel";

/** Tells the debut modal (in the tab that opened checkout) how the payment went. */
export function CheckoutBroadcast({ orderId, status }: CheckoutMessage) {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHECKOUT_CHANNEL);
    channel.postMessage({ orderId, status } satisfies CheckoutMessage);
    channel.close();
  }, [orderId, status]);
  return null;
}
