import { describe, expect, it } from "vitest";
import type { Env } from "@/env";
import { setupChecklist } from "./setup";

describe("setupChecklist", () => {
  it("reports configured services from env presence", () => {
    const items = setupChecklist({ ADMIN_EMAIL: "a@x.test", PAYPAL_CLIENT_ID: "id", EMAIL_FROM: "x" } as Env);
    const by = Object.fromEntries(items.map((i) => [i.label, i]));
    expect(by["Admin email"].ok).toBe(true);
    // PayPal needs both halves.
    expect(by.Payments.ok).toBe(false);
    expect(by["Email (Resend)"]).toMatchObject({ ok: false, required: true });
    expect(by["AI prefill"]).toMatchObject({ ok: false, required: false });
  });
});
