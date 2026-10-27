import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

describe("secrets at rest", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips and never repeats a ciphertext", () => {
    const a = encryptSecret("hunter2 ✓", key);
    expect(a.startsWith("v1.")).toBe(true);
    expect(a).not.toContain("hunter2");
    expect(encryptSecret("hunter2 ✓", key)).not.toBe(a);
    expect(decryptSecret(a, key)).toBe("hunter2 ✓");
  });

  it("rejects the wrong key, tampering and bad keys", () => {
    const sealed = encryptSecret("pw", key);
    expect(() => decryptSecret(sealed, randomBytes(32).toString("base64"))).toThrow("wrong key");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("xx").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => encryptSecret("pw", "short")).toThrow("32 bytes");
  });
});
