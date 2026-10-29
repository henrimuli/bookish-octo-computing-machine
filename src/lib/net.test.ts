import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateIp, safeFetchBytes, safeFetchText, UnsafeUrlError } from "./net";

const publicDns = async () => ["93.184.216.34"];

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  it("allows public http(s) URLs", async () => {
    await expect(assertPublicUrl("https://example.com/x", publicDns)).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ["ftp://example.com", "http(s)"],
    ["https://example.com:8080", "ports"],
    ["https://user:pw@example.com", "credentials"],
    ["http://localhost/", "publicly"],
    ["http://169.254.169.254/latest/meta-data", "publicly"],
    ["http://[::1]/", "publicly"],
    ["not a url", "valid"],
  ])("rejects %s", async (url, msg) => {
    await expect(assertPublicUrl(url, publicDns)).rejects.toThrow(msg);
  });

  it("rejects hostnames that resolve to private addresses (DNS-based SSRF)", async () => {
    await expect(
      assertPublicUrl("https://sneaky.example", async () => ["93.184.216.34", "10.0.0.5"]),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe("safeFetchText", () => {
  it("re-checks every redirect hop", async () => {
    const fetchImpl = (async (url: URL) => {
      if (url.hostname === "start.example") {
        return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
      }
      return new Response("secret");
    }) as unknown as typeof fetch;
    await expect(safeFetchText("https://start.example/", { fetchImpl, resolve: publicDns })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it("caps the body size", async () => {
    const fetchImpl = (async () => new Response("a".repeat(5000))) as unknown as typeof fetch;
    const res = await safeFetchText("https://big.example/", { fetchImpl, resolve: publicDns, maxBytes: 1000 });
    expect(res.body.length).toBeLessThan(5000);
  });
});

describe("safeFetchBytes", () => {
  const image = (bytes: number) => async () =>
    new Response(new Uint8Array(bytes).fill(7), { status: 200, headers: { "content-type": "image/png" } });

  it("returns the body as bytes", async () => {
    const res = await safeFetchBytes("https://cdn.example/og.png", "image/*", {
      fetchImpl: image(3000),
      resolve: publicDns,
    });
    expect(res).toMatchObject({ status: 200, contentType: "image/png", truncated: false });
    expect(res.body.byteLength).toBe(3000);
  });

  it("flags bodies cut off at maxBytes", async () => {
    const res = await safeFetchBytes("https://cdn.example/og.png", "image/*", {
      fetchImpl: image(3000),
      resolve: publicDns,
      maxBytes: 1000,
    });
    expect(res.truncated).toBe(true);
    expect(res.body.byteLength).toBe(1000);
  });
});
