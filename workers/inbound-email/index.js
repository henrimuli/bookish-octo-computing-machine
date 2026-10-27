import PostalMime from "postal-mime";

const encoder = new TextEncoder();

async function sign(secret, payload) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  /** Cloudflare Email Routing hands each message to this handler. */
  async email(message, env) {
    const parsed = await PostalMime.parse(message.raw);
    const body = JSON.stringify({
      to: message.to,
      from: message.from,
      subject: parsed.subject ?? "",
      text: (parsed.text ?? "").slice(0, 500_000),
      html: parsed.html ? parsed.html.slice(0, 1_000_000) : null,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const res = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbound-Timestamp": timestamp,
        "X-Inbound-Signature": await sign(env.INBOUND_SECRET, `${timestamp}.${body}`),
      },
      body,
    });
    // Throwing makes Cloudflare retry delivery later; a 4xx won't get better, so bounce it.
    if (res.status >= 500) throw new Error(`Inbound endpoint returned ${res.status}`);
    if (!res.ok) message.setReject(`Not accepted (${res.status})`);
  },
};
