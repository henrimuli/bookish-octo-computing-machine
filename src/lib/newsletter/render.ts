import { brand } from "@/config/brand";

/** Pure renderer for the weekly digest. Data in, subject/html/text out. */

export type DigestProduct = { name: string; tagline: string; url: string; votes?: number; place?: number };

export type DigestData = {
  closedWeekLabel: string;
  newWeekLabel: string;
  winners: DigestProduct[];
  topOfWeek: DigestProduct[];
  debutingNow: Array<DigestProduct & { featured: boolean }>;
  sponsor: { name: string; tagline: string; url: string } | null;
  siteUrl: string;
};

const medal = (place?: number) => (place ? (["🥇", "🥈", "🥉"][place - 1] ?? `#${place}`) : "");

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function digestSubject(d: DigestData): string {
  const top = d.winners[0];
  return top ? `${top.name} wins ${d.closedWeekLabel}, plus this week's debuts` : `This week's debuts on DebutYard`;
}

export function renderDigest(d: DigestData, unsubscribeUrl: string): { subject: string; html: string; text: string } {
  const c = brand.light;
  const item = (p: DigestProduct, prefix = "") =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid ${c.border}">
      <a href="${esc(p.url)}" style="color:${c.text};font-weight:600;text-decoration:none">${prefix}${esc(p.name)}</a>
      ${typeof p.votes === "number" ? `<span style="color:${c.muted};font-size:13px"> · ▲ ${p.votes}</span>` : ""}
      <div style="color:${c.muted};font-size:14px">${esc(p.tagline)}</div></td></tr>`;
  const section = (title: string, rows: string) =>
    rows
      ? `<h2 style="font-size:16px;margin:28px 0 4px;color:${c.text}">${title}</h2><table width="100%" cellspacing="0" cellpadding="0">${rows}</table>`
      : "";

  const sponsor = d.sponsor
    ? `<div style="margin:28px 0;padding:16px;border:1px solid ${c.border};border-radius:12px;background:${c.bg}">
        <div style="font-size:11px;letter-spacing:.06em;color:${c.muted}">SPONSOR</div>
        <a href="${esc(d.sponsor.url)}" style="color:${c.primary};font-weight:600;font-size:16px;text-decoration:none">${esc(d.sponsor.name)}</a>
        <div style="color:${c.text};font-size:14px">${esc(d.sponsor.tagline)}</div></div>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:${c.bg};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;background:${c.surface}">
  <div style="font-size:20px;font-weight:800;color:${c.text}">Debut<span style="color:${c.primary}">Yard</span></div>
  <p style="color:${c.muted};font-size:14px;margin:4px 0 0">Your weekly look at what just launched.</p>
  ${section(`Debut of the Week · ${esc(d.closedWeekLabel)}`, d.winners.map((p) => item(p, `${medal(p.place)} `)).join(""))}
  ${sponsor}
  ${section(`Debuting now · ${esc(d.newWeekLabel)}`, d.debutingNow.map((p) => item(p, p.featured ? "★ " : "")).join(""))}
  ${section(`Also loved last week`, d.topOfWeek.map((p) => item(p)).join(""))}
  <p style="margin:28px 0 0"><a href="${esc(d.siteUrl)}" style="display:inline-block;background:${c.primary};color:${c.primaryInk};padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Vote on this week's debuts</a></p>
  <p style="color:${c.muted};font-size:12px;margin-top:32px">You're getting this because you subscribed on DebutYard. <a href="${esc(unsubscribeUrl)}" style="color:${c.muted}">Unsubscribe</a>.</p>
</div></body></html>`;

  const line = (p: DigestProduct, prefix = "") =>
    `${prefix}${p.name}: ${p.tagline}${typeof p.votes === "number" ? ` (▲ ${p.votes})` : ""}\n  ${p.url}`;
  const text = [
    "DebutYard: your weekly look at what just launched.",
    d.winners.length
      ? `\nDEBUT OF THE WEEK · ${d.closedWeekLabel}\n${d.winners.map((p) => line(p, `${medal(p.place)} `)).join("\n")}`
      : "",
    d.sponsor ? `\nSPONSOR: ${d.sponsor.name}: ${d.sponsor.tagline}\n  ${d.sponsor.url}` : "",
    d.debutingNow.length
      ? `\nDEBUTING NOW · ${d.newWeekLabel}\n${d.debutingNow.map((p) => line(p, p.featured ? "★ " : "")).join("\n")}`
      : "",
    d.topOfWeek.length ? `\nALSO LOVED LAST WEEK\n${d.topOfWeek.map((p) => line(p)).join("\n")}` : "",
    `\nVote on this week's debuts: ${d.siteUrl}`,
    `\nUnsubscribe: ${unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: digestSubject(d), html, text };
}
