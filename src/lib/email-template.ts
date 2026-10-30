import { brand } from "@/config/brand";
import { site } from "@/config/site";

/**
 * The one layout every DebutYard email uses. Call sites describe an email as
 * blocks; this turns them into table-based HTML with inline styles (what
 * Gmail and Outlook need) plus a matching plain-text body, escaping every
 * string once, here.
 *
 * Variants: "customer" (makers, buyers, subscribers), "newsletter" (adds an
 * unsubscribe link) and "staff" (ADMIN_EMAIL: dark header, compact footer).
 */

export type Tone = "good" | "warn" | "bad" | "neutral";

export type EmailItem = {
  name: string;
  detail?: string;
  href?: string;
  /** A small status pill on the right, e.g. "Removed". */
  chip?: { label: string; tone: Tone };
  /** Muted text on the right, e.g. "👏 412". */
  aside?: string;
  /** 1–3 draws a gold/silver/bronze place marker. */
  medal?: number;
  /** Shows a logo tile (the image, or the name's initial when null). Omit for no tile. */
  logo?: string | null;
};

export type Block =
  | { heading: string }
  /** A paragraph; `[label](url)` becomes a link. */
  | { text: string }
  | { button: string; href: string }
  | { link: string; href: string }
  | { callout: string; text: string }
  | { facts: Array<[label: string, value: string]> }
  | { bullets: string[] }
  /** `box` draws the rows inside a tinted, bordered box under that label (e.g. a sponsor). */
  | { items: EmailItem[]; box?: string }
  /** A small uppercase label over a group of items. */
  | { section: string }
  | { code: string }
  /** Small muted text: expiry times, "if you didn't ask for this". */
  | { note: string };

export type EmailInput = {
  variant: "customer" | "newsletter" | "staff";
  /** Shown on the right of the header: "Billing", "Link Monitor"… */
  label: string;
  subject: string;
  /** Inbox preview line. Defaults to the first text block. */
  preheader?: string;
  /** Why the recipient got this, completing "You're getting this because …". */
  reason?: string;
  /** Staff: what sent this email. */
  trigger?: string;
  /** Newsletter only. */
  unsubscribeUrl?: string;
  blocks: Block[];
};

export type RenderedEmail = { subject: string; html: string; text: string };

const L = brand.light;
const D = brand.dark;
const STAFF_BAND = "#10201B";
const MEDALS = brand.medals;
const TONES: Record<Tone, { fg: string; bg: string; dfg: string; dbg: string }> = {
  good: { fg: "#0B7D53", bg: "#E3F5EC", dfg: D.primary, dbg: "#11302A" },
  warn: { fg: "#8A6100", bg: "#FFF4D6", dfg: "#E8C15A", dbg: "#33290E" },
  bad: { fg: "#B4402B", bg: "#FBEBE7", dfg: "#F08A76", dbg: "#3A1D17" },
  neutral: { fg: L.muted, bg: L.bg, dfg: D.muted, dbg: D.bg },
};

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const DISPLAY = `'Bricolage Grotesque',${FONT}`;

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const abs = (path: string) => new URL(path, site.url).toString();

function inline(s: string): string {
  return esc(s).replace(
    LINK_RE,
    `<a href="$2" class="dy-link" style="color:${L.primary};font-weight:600;text-decoration:underline">$1</a>`,
  );
}
const plain = (s: string) => s.replace(LINK_RE, "$1 ($2)");

/** A block-level table cell wrapper; every body block sits in one row of the body table. */
const row = (inner: string, pad = "0 0 16px") => `<tr><td style="padding:${pad}">${inner}</td></tr>`;

function itemHtml(i: EmailItem, last: boolean): string {
  const border = last ? "" : `border-bottom:1px solid ${L.border};`;
  const name = i.href
    ? `<a href="${esc(i.href)}" class="dy-text" style="color:${L.text};font-weight:600;text-decoration:none">${esc(i.name)}</a>`
    : `<span class="dy-text" style="color:${L.text};font-weight:600">${esc(i.name)}</span>`;
  // Gmail and Outlook drop SVG images, so an SVG logo gets the initial tile instead.
  const logo = i.logo && !/\.svg(\?|#|$)/i.test(i.logo) ? i.logo : null;
  const tile =
    i.logo === undefined
      ? ""
      : `<td width="52" valign="top" class="dy-rule" style="width:52px;padding:12px 12px 12px 0;${border}">${
          logo
            ? `<img src="${esc(logo)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:8px;border:1px solid ${L.border};background:${L.surface};object-fit:contain">`
            : `<div class="dy-tile" style="width:40px;height:40px;line-height:40px;border-radius:8px;background:#E3F5EC;color:${L.primary};font:700 17px/40px ${DISPLAY};text-align:center">${esc(i.name.slice(0, 1).toUpperCase())}</div>`
        }</td>`;
  const medal = i.medal
    ? `<span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background:${MEDALS[i.medal - 1] ?? L.muted};color:#FFFFFF;font-size:12px;font-weight:700;text-align:center;vertical-align:middle;margin-left:8px">${i.medal}</span>`
    : "";
  const chip = i.chip
    ? `<span class="dy-chip-${i.chip.tone}" style="display:inline-block;white-space:nowrap;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:600;color:${TONES[i.chip.tone].fg};background:${TONES[i.chip.tone].bg}">${esc(i.chip.label)}</span>`
    : "";
  const aside = i.aside ? `<span class="dy-muted" style="color:${L.muted};font-size:13px">${esc(i.aside)}</span>` : "";
  const right =
    chip || aside || medal
      ? `<td align="right" valign="top" class="dy-rule" style="padding:12px 0 12px 12px;white-space:nowrap;${border}">${chip}${aside}${medal}</td>`
      : "";
  return `<tr>${tile}<td valign="top" class="dy-rule" style="padding:12px 0;${border}">${name}${
    i.detail
      ? `<div class="dy-muted" style="color:${L.muted};font-size:14px;line-height:1.45;margin-top:2px">${esc(i.detail)}</div>`
      : ""
  }</td>${right}</tr>`;
}

function blockHtml(b: Block): string {
  if ("heading" in b)
    return row(
      `<h1 class="dy-text" style="margin:0;font:700 24px/1.25 ${DISPLAY};letter-spacing:-0.01em;color:${L.text}">${esc(b.heading)}</h1>`,
      "0 0 18px",
    );
  if ("callout" in b)
    return row(
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="dy-soft" style="background:${L.bg};border:1px solid ${L.border};border-radius:10px;padding:14px 16px"><div class="dy-text" style="font-size:14px;font-weight:600;color:${L.text}">${esc(b.callout)}</div><div class="dy-muted" style="font-size:14px;line-height:1.5;color:${L.muted};margin-top:4px">${inline(b.text)}</div></td></tr></table>`,
    );
  if ("text" in b)
    return row(
      `<p class="dy-text" style="margin:0;font-size:15px;line-height:1.6;color:${L.text}">${inline(b.text)}</p>`,
    );
  if ("button" in b)
    return row(
      `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td class="dy-btn" bgcolor="${L.primary}" style="border-radius:8px;background:${L.primary}"><a href="${esc(b.href)}" class="dy-btn-a" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;line-height:20px;color:${L.primaryInk};text-decoration:none;border-radius:8px">${esc(b.button)}</a></td></tr></table>`,
      "4px 0 20px",
    );
  if ("link" in b)
    return row(
      `<a href="${esc(b.href)}" class="dy-link" style="color:${L.primary};font-size:15px;font-weight:600;text-decoration:none">${esc(b.link)} &rarr;</a>`,
    );
  if ("facts" in b)
    return row(
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="dy-border" style="border:1px solid ${L.border};border-radius:10px;border-collapse:separate">${b.facts
        .map(
          ([k, v], i) =>
            `<tr><td class="dy-muted dy-rule" width="120" valign="top" style="width:120px;padding:9px 14px;font-size:14px;color:${L.muted};${i ? `border-top:1px solid ${L.border};` : ""}">${esc(k)}</td><td class="dy-text dy-rule" valign="top" style="padding:9px 14px;font-size:14px;font-weight:500;color:${L.text};word-break:break-word;${i ? `border-top:1px solid ${L.border};` : ""}">${inline(v)}</td></tr>`,
        )
        .join("")}</table>`,
    );
  if ("bullets" in b)
    return row(
      `<ul class="dy-text" style="margin:0;padding-left:20px;font-size:15px;line-height:1.6;color:${L.text}">${b.bullets.map((x) => `<li style="margin:0 0 4px">${inline(x)}</li>`).join("")}</ul>`,
    );
  if ("items" in b) {
    const rows = b.items.map((i, n) => itemHtml(i, n === b.items.length - 1)).join("");
    if (b.box !== undefined) {
      return row(
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="dy-soft" style="background:${L.bg};border:1px solid ${L.border};border-radius:12px;padding:12px 16px 2px"><div class="dy-muted" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:${L.muted}">${esc(b.box)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:15px">${rows}</table></td></tr></table>`,
        "8px 0 18px",
      );
    }
    return row(
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="dy-rule" style="border-top:1px solid ${L.border};font-size:15px">${rows}</table>`,
      "0 0 18px",
    );
  }
  if ("section" in b)
    return row(
      `<div class="dy-muted" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:${L.muted}">${esc(b.section)}</div>`,
      "8px 0 8px",
    );
  if ("code" in b)
    return row(
      `<pre class="dy-soft dy-text" style="margin:0;white-space:pre-wrap;word-break:break-all;background:${L.bg};border:1px solid ${L.border};border-radius:10px;padding:14px 16px;font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;color:${L.text}">${esc(b.code)}</pre>`,
    );
  return row(
    `<p class="dy-muted" style="margin:0;font-size:13px;line-height:1.55;color:${L.muted}">${inline(b.note)}</p>`,
  );
}

function blockText(b: Block): string {
  if ("heading" in b) return b.heading;
  if ("callout" in b) return `${b.callout}\n${plain(b.text)}`;
  if ("text" in b) return plain(b.text);
  if ("button" in b) return `${b.button}: ${b.href}`;
  if ("link" in b) return `${b.link}: ${b.href}`;
  if ("facts" in b) return b.facts.map(([k, v]) => `${k}: ${plain(v)}`).join("\n");
  if ("bullets" in b) return b.bullets.map((x) => `- ${plain(x)}`).join("\n");
  if ("items" in b)
    return (
      (b.box
        ? `${b.box.toUpperCase()}
`
        : "") +
      b.items
        .map((i) => {
          const tail = [i.chip?.label, i.aside].filter(Boolean).join(", ");
          const lead = i.medal ? `#${i.medal} ` : "- ";
          return `${lead}${i.name}${i.detail ? `: ${i.detail}` : ""}${tail ? ` (${tail})` : ""}${i.href ? `\n  ${i.href}` : ""}`;
        })
        .join("\n")
    );
  if ("section" in b) return b.section.toUpperCase();
  if ("code" in b) return b.code;
  return plain(b.note);
}

function firstText(blocks: Block[]): string {
  for (const b of blocks) if ("text" in b && !("callout" in b)) return plain(b.text);
  return "";
}

/** Dark palette for the clients that honour prefers-color-scheme (Apple Mail, iOS, Outlook.com). */
const DARK_CSS = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
  .dy-bg{background:${D.bg}!important}
  .dy-card{background:${D.surface}!important;border-color:${D.border}!important}
  .dy-text{color:${D.text}!important}
  .dy-muted{color:${D.muted}!important}
  .dy-link,.dy-yard{color:${D.primary}!important}
  .dy-border,.dy-rule{border-color:${D.border}!important}
  .dy-soft{background:${D.bg}!important;border-color:${D.border}!important}
  .dy-btn{background:${D.primary}!important}
  .dy-btn-a{color:${D.primaryInk}!important}
  .dy-bar{background:${D.primary}!important}
  .dy-tile{background:#11302A!important;color:${D.primary}!important}
  .dy-logo-light{display:none!important}
  .dy-logo-dark{display:block!important}
  ${(Object.keys(TONES) as Tone[]).map((t) => `.dy-chip-${t}{color:${TONES[t].dfg}!important;background:${TONES[t].dbg}!important}`).join("\n  ")}
}
@media only screen and (max-width:620px){
  .dy-pad{padding-left:20px!important;padding-right:20px!important}
}`;

function header(e: EmailInput): string {
  const staff = e.variant === "staff";
  const word = (debut: string, yard: string, cls: string) =>
    `<span class="${cls}" style="font:700 19px/1 ${DISPLAY};letter-spacing:-0.01em;color:${debut}">Debut<span class="${cls ? "dy-yard" : ""}" style="color:${yard}">Yard</span></span>`;
  const mark = (file: string, cls: string, hidden = false) =>
    `<img src="${abs(`/email/${file}`)}" width="26" height="26" alt="" class="${cls}" style="${hidden ? "display:none;" : "display:block;"}width:26px;height:26px;border:0">`;
  const logo = staff
    ? `<td valign="middle" style="padding-right:9px">${mark("logo-mark-mint.png", "")}</td><td valign="middle">${word("#E9F3EF", D.primary, "")}</td>`
    : // Apple Mail's dark mode swaps in the mint mark; everywhere else shows the green one.
      `<td valign="middle" style="padding-right:9px">${mark("logo-mark.png", "dy-logo-light")}<!--[if !mso]><!-->${mark("logo-mark-mint.png", "dy-logo-dark", true)}<!--<![endif]--></td><td valign="middle">${word(L.text, L.primary, "dy-text")}</td>`;
  const pill = staff
    ? `<span style="display:inline-block;background:${D.primary};color:${D.primaryInk};border-radius:99px;padding:2px 8px;font-size:10px;letter-spacing:.1em;margin-right:8px">STAFF</span>`
    : "";
  return `${staff ? "" : `<tr><td class="dy-bar" height="4" style="height:4px;line-height:4px;font-size:0;background:${L.primary}">&nbsp;</td></tr>`}
<tr><td class="dy-pad ${staff ? "" : "dy-rule"}" style="padding:22px 32px;${staff ? `background:${STAFF_BAND};` : `border-bottom:1px solid ${L.border};`}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td valign="middle"><a href="${abs(staff ? "/admin/dashboard" : "/")}" style="text-decoration:none"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${logo}</tr></table></a></td>
    <td align="right" valign="middle" class="${staff ? "" : "dy-muted"}" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:${staff ? D.muted : L.muted}">${pill}${esc(e.label)}</td>
  </tr></table>
</td></tr>`;
}

const FOOTER_LINKS: Array<[string, string]> = [
  ["This week", "/"],
  ["Your dashboard", "/dashboard"],
  ["Submission service", "/submission-service"],
  ["Advertise", "/advertise"],
];
const STAFF_LINKS: Array<[string, string]> = [
  ["Admin", "/admin/dashboard"],
  ["Review queue", "/admin/review"],
  ["Ops console", "/admin/submissions"],
  ["Directories", "/admin/directories"],
];

const linkRow = (links: Array<[string, string]>, muted = false) =>
  links
    .map(
      ([label, href]) =>
        `<a href="${esc(href.startsWith("http") ? href : abs(href))}" class="${muted ? "dy-muted" : "dy-text"}" style="color:${muted ? L.muted : L.text};text-decoration:${muted ? "underline" : "none"};font-weight:${muted ? 400 : 500};margin:0 8px;white-space:nowrap">${esc(label)}</a>`,
    )
    .join(" ");

function footer(e: EmailInput): string {
  const p = (inner: string, pad = "0 0 12px") =>
    `<tr><td align="center" class="dy-muted" style="padding:${pad};font-size:12.5px;line-height:1.6;color:${L.muted}">${inner}</td></tr>`;
  if (e.variant === "staff") {
    return [p(linkRow(STAFF_LINKS)), p(`${e.trigger ? `${esc(e.trigger)} ` : ""}Sent to the staff inbox.`, "0")].join(
      "",
    );
  }
  const legal: Array<[string, string]> = [
    ["Terms", "/terms"],
    ["Privacy", "/privacy"],
    ["X / Twitter", site.social.x],
  ];
  if (e.variant === "newsletter" && e.unsubscribeUrl) legal.push(["Unsubscribe", e.unsubscribeUrl]);
  return [
    p(
      `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td valign="middle" style="padding-right:7px"><img src="${abs("/email/logo-mark.png")}" width="18" height="18" alt="" style="display:block;width:18px;height:18px;border:0"></td><td valign="middle" class="dy-text" style="font:600 13px/1 ${DISPLAY};color:${L.text}">${esc(site.tagline)}</td></tr></table>`,
    ),
    p(linkRow(FOOTER_LINKS)),
    e.reason
      ? p(
          `You're getting this because ${esc(e.reason)}. Questions? Reply to this email or write to <a href="mailto:${site.supportEmail}" class="dy-muted" style="color:${L.muted}">${site.supportEmail}</a>.`,
        )
      : p(
          `Questions? Write to <a href="mailto:${site.supportEmail}" class="dy-muted" style="color:${L.muted}">${site.supportEmail}</a>.`,
        ),
    p(linkRow(legal, true)),
    p(`&copy; ${new Date().getUTCFullYear()} ${esc(site.legalName)} &middot; Nairobi`, "0"),
  ].join("");
}

export function renderEmail(e: EmailInput): RenderedEmail {
  const preheader = e.preheader ?? firstText(e.blocks);
  const signOff =
    e.variant === "staff"
      ? ""
      : row(
          `<p class="dy-muted" style="margin:0;font-size:15px;color:${L.muted}">— The ${esc(site.name)} team</p>`,
          "4px 0 0",
        );

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(e.subject)}</title><style>${DARK_CSS}</style></head>
<body class="dy-bg" style="margin:0;padding:0;background:${L.bg};font-family:${FONT};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(30)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="dy-bg" style="background:${L.bg}"><tr><td align="center" style="padding:28px 12px 36px">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
    <tr><td>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="dy-card" style="background:${L.surface};border:1px solid ${L.border};border-radius:14px;border-collapse:separate;overflow:hidden">
        ${header(e)}
        <tr><td class="dy-pad" style="padding:30px 32px 32px;font-family:${FONT}">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${e.blocks.map(blockHtml).join("\n")}
            ${signOff}
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td class="dy-pad" style="padding:24px 32px 0;font-family:${FONT}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${footer(e)}</table>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const foot =
    e.variant === "staff"
      ? [`${e.trigger ? `${e.trigger} ` : ""}Sent to the staff inbox.`, `Admin: ${abs("/admin/dashboard")}`]
      : [
          `— The ${site.name} team`,
          [e.reason ? `You're getting this because ${e.reason}.` : "", `Questions? Write to ${site.supportEmail}.`]
            .filter(Boolean)
            .join(" "),
          e.variant === "newsletter" && e.unsubscribeUrl ? `Unsubscribe: ${e.unsubscribeUrl}` : "",
          `${site.legalName} · Nairobi · ${site.url}`,
        ].filter(Boolean);
  const text = [...e.blocks.map(blockText), ...foot].join("\n\n");

  return { subject: e.subject, html, text };
}
