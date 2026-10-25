import { ProviderError } from "./types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** JSON request helper that turns non-2xx responses into ProviderError. */
export async function requestJson<T>(
  fetchImpl: FetchLike,
  provider: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetchImpl(url, init);
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) ||
      `${res.status} ${res.statusText}`;
    throw new ProviderError(`${provider}: ${message}`, res.status, body);
  }
  return body as T;
}

/** Cents → "15.00" for APIs that take decimal strings. */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** "15.00" → 1500, rounding to avoid float artefacts. */
export function decimalToCents(value: string): number {
  return Math.round(Number.parseFloat(value) * 100);
}
