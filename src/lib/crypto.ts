import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for small secrets at rest (directory account passwords).
 * Format: "v1.<iv>.<tag>.<ciphertext>", base64url parts. Pure: the key is passed in.
 */

export class CryptoError extends Error {}

function keyBytes(key: string) {
  const k = Buffer.from(key, "base64");
  if (k.length !== 32) throw new CryptoError("CREDENTIALS_KEY must be 32 bytes, base64-encoded.");
  return k;
}

export function encryptSecret(plain: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decryptSecret(sealed: string, key: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || data === undefined) throw new CryptoError("Not an encrypted secret.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof CryptoError) throw err;
    throw new CryptoError("Couldn't decrypt: wrong key or tampered data.");
  }
}
