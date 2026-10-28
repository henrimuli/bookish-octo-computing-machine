import { connection } from "next/server";
import { site } from "@/config/site";
import { env } from "@/env";
import { publishedPosts } from "@/lib/blog/service";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export async function GET() {
  await connection();
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const posts = await publishedPosts(30);
  const items = posts
    .map(
      (p) =>
        `<item><title>${esc(p.title)}</title><link>${base}/blog/${p.slug}</link><guid>${base}/blog/${p.slug}</guid>${
          p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""
        }<description>${esc(p.excerpt)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)} blog</title><link>${base}/blog</link><description>Weekly recaps of every debut on ${esc(site.name)}.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
