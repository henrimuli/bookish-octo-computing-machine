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

  it("names the R2 variables that are missing", () => {
    const items = setupChecklist({
      R2_ACCOUNT_ID: "a",
      R2_ACCESS_KEY_ID: "k",
      R2_SECRET_ACCESS_KEY: "s",
      R2_BUCKET: "b",
      EMAIL_FROM: "x",
    } as Env);
    expect(items.find((i) => i.label === "File storage (R2)")).toMatchObject({
      ok: false,
      hint: "missing R2_PUBLIC_URL",
    });
  });
});
