import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetches a user-supplied URL safely: http(s) only, standard ports, public IPs
 * only (re-checked on every redirect), with a timeout and a size cap.
 * Used for URL prefill and badge verification.
 */

export const BOT_USER_AGENT = "Mozilla/5.0 (compatible; DebutYardBot/1.0; +https://debutyard.com/bot)";

export class UnsafeUrlError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) {
    const mapped = v6.slice(7);
    return isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") || // unique local
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") || // link-local
    v6.startsWith("ff") // multicast
  );
}

type Resolver = (hostname: string) => Promise<string[]>;

const defaultResolver: Resolver = async (hostname) => (await lookup(hostname, { all: true })).map((r) => r.address);

/** Throws UnsafeUrlError unless the URL is http(s) on a standard port resolving only to public IPs. */
export async function assertPublicUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http(s) URLs are allowed.");
  if (url.port && url.port !== "80" && url.port !== "443")
    throw new UnsafeUrlError("Non-standard ports aren't allowed.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials aren't allowed.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("That address isn't publicly reachable.");
  }
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError("We couldn't find that domain.");
  if (addresses.some(isPrivateIp)) throw new UnsafeUrlError("That address isn't publicly reachable.");
  return url;
}

export type SafeResponse = { url: string; status: number; contentType: string; body: string };

/** GETs a public URL and returns the (truncated) text body. Follows up to 5 redirects. */
export async function safeFetchText(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; resolve?: Resolver; fetchImpl?: typeof fetch } = {},
): Promise<SafeResponse> {
  const { timeoutMs = 10_000, maxBytes = 1_500_000, resolve = defaultResolver, fetchImpl = fetch } = opts;
  const deadline = AbortSignal.timeout(timeoutMs);
  let current = raw;

  for (let hop = 0; hop <= 5; hop++) {
    const url = await assertPublicUrl(current, resolve);
    const res = await fetchImpl(url, {
      redirect: "manual",
      signal: deadline,
      headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }

    let body = "";
    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value.byteLength > maxBytes - received ? value.subarray(0, maxBytes - received) : value;
        received += chunk.byteLength;
        body += decoder.decode(chunk, { stream: true });
      }
      await reader.cancel().catch(() => {});
    }
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body };
  }
  throw new UnsafeUrlError("Too many redirects.");
}
