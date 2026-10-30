import { site } from "@/config/site";
import { renderEmail, type RenderedEmail } from "@/lib/email-template";
import { renderDigest } from "@/lib/newsletter/render";

/**
 * Sample data for the email preview: one email per header label, with copy
 * taken from the real senders. The digest goes through its real renderer.
 */

const url = (path: string) => new URL(path, site.url).toString();

export type Sample = { id: string; name: string; audience: string; render: () => RenderedEmail };

export const samples: Sample[] = [
  {
    id: "approved",
    name: "Listing approved",
    audience: "Makers",
    render: () =>
      renderEmail({
        variant: "customer",
        label: "Your listing",
        subject: "Kaptn is approved and live",
        preheader: "Applause runs until Sunday at 23:59 UTC.",
        reason: "you listed Kaptn on DebutYard",
        blocks: [
          { heading: "Kaptn is live on this week's board" },
          {
            text: "Good news: Kaptn is approved and live now on this week's board (27 Oct – 2 Nov). Applause runs until Sunday at 23:59 UTC.",
          },
          { button: "View your listing", href: url("/p/kaptn") },
          {
            callout: "Keep your followed link",
            text: "To keep a followed (dofollow) link from your listing, add the DebutYard badge to your homepage. Your snippet and a one-click check are in your dashboard.",
          },
          { link: "Open your dashboard", href: url("/dashboard") },
        ],
      }),
  },
  {
    id: "sign-in",
    name: "Sign-in link",
    audience: "Anyone signing in",
    render: () =>
      renderEmail({
        variant: "customer",
        label: "Sign in",
        subject: "Your DebutYard sign-in link",
        preheader: "This link expires in 15 minutes.",
        reason: "someone asked to sign in to DebutYard with this address",
        blocks: [
          { heading: "Sign in to DebutYard" },
          { text: "Use the button below to sign in. It expires in 15 minutes." },
          { button: "Sign in", href: url("/api/auth/magic-link/verify?token=sample") },
          {
            note: `Button not working? Paste this link into your browser: ${url("/api/auth/magic-link/verify?token=sample")}`,
          },
          { note: "If you didn't ask for this, ignore this email. Nobody can sign in without the link." },
        ],
      }),
  },
  {
    id: "link-monitor",
    name: "Link Monitor alert",
    audience: "Subscribers",
    render: () =>
      renderEmail({
        variant: "customer",
        label: "Link Monitor",
        subject: "Link Monitor: 2 links changed, 1 back",
        reason: "Link Monitor checks your backlinks for you",
        blocks: [
          { heading: "Some of your backlinks changed" },
          { text: "Here's what changed since our last check." },
          {
            items: [
              {
                name: "SaaSHub",
                detail: "https://www.saashub.com/kaptn",
                chip: { label: "Removed or unreachable", tone: "bad" },
              },
              {
                name: "BetaList",
                detail: "https://betalist.com/startups/kaptn",
                chip: { label: "Now nofollow", tone: "warn" },
              },
              {
                name: "Uneed",
                detail: "https://www.uneed.best/tool/kaptn",
                chip: { label: "Dofollow again", tone: "good" },
              },
            ],
          },
          {
            text: "A directory may have changed its link policy or removed the listing. It's worth checking the page and contacting the directory.",
          },
          { button: "See all your links", href: url("/dashboard/links") },
        ],
      }),
  },
  {
    id: "billing",
    name: "Payment failed",
    audience: "Subscribers",
    render: () =>
      renderEmail({
        variant: "customer",
        label: "Billing",
        subject: "Your Maker Pro payment didn't go through",
        reason: "you have a DebutYard plan",
        blocks: [
          { heading: "Your Maker Pro payment didn't go through" },
          {
            text: "We couldn't take the renewal payment for Maker Pro. Your provider will retry. To keep your plan, check your card or payment method with Paystack.",
          },
          { text: "Your plan stays on for now. If the payment still fails, it ends on 6 November 2026." },
          { button: "Manage your plan", href: url("/dashboard/billing") },
        ],
      }),
  },
  {
    id: "ad-results",
    name: "Ad results",
    audience: "Advertisers",
    render: () =>
      renderEmail({
        variant: "customer",
        label: "Advertising",
        subject: "Your Category sponsor results: 84 clicks",
        reason: "you booked a Category sponsor on DebutYard",
        blocks: [
          { heading: "Your Category sponsor results" },
          { text: "Your Category sponsor for Kaptn has finished." },
          {
            facts: [
              ["Impressions", "12,480"],
              ["Clicks", "84"],
              ["Cost per click", "$0.58"],
            ],
          },
          { button: "Book again", href: url("/advertise") },
        ],
      }),
  },
  {
    id: "badges",
    name: "Directory badges",
    audience: "Order buyers",
    render: () =>
      renderEmail({
        variant: "customer",
        label: "Submission service",
        subject: "One step for your listings: add your directory badges",
        reason: "you ordered DebutYard's directory submission service",
        blocks: [
          { heading: "Add your directory badges" },
          {
            text: "2 of the directories we're submitting Kaptn to only list products that show their badge. Paste this block into your site's footer (any page we can reach from your homepage works):",
          },
          {
            code: '<a href="https://example-directory.com/kaptn"><img src="https://example-directory.com/badge.svg" alt="Featured on Example Directory"></a>',
          },
          {
            text: "We check your site daily and submit each one as soon as its badge is up. Any still missing after 7 days are swapped for directories that don't need a badge.",
          },
          { button: "Open your dashboard", href: url("/orders/sample") },
        ],
      }),
  },
  {
    id: "staff-order",
    name: "New submission order",
    audience: "Staff",
    render: () =>
      renderEmail({
        variant: "staff",
        label: "Orders",
        subject: "New submission order: Growth (bundled with Spotlight)",
        trigger: "Sent by the submission service.",
        blocks: [
          { heading: "New submission order: Growth" },
          {
            facts: [
              ["Buyer", "founder@kaptn.app"],
              ["Package", "Growth, 100 directories"],
              ["Paid", "Bundled with Spotlight"],
              ["Status", "Waiting for intake"],
            ],
          },
          { button: "Open in the ops console", href: url("/admin/submissions") },
        ],
      }),
  },
  {
    id: "staff-todo",
    name: "Paid tier to-do",
    audience: "Staff",
    render: () =>
      renderEmail({
        variant: "staff",
        label: "To do",
        subject: "To do for Kaptn (premium)",
        trigger: "Sent when a paid tier with hand-delivered perks is bought.",
        blocks: [
          { heading: "To do for Kaptn" },
          { text: "Kaptn bought premium. These perks are delivered by hand:" },
          { bullets: ["Include in this week's newsletter", "Write the launch post (blog)"] },
          { button: "Open the listing", href: url("/p/kaptn") },
        ],
      }),
  },
  {
    id: "digest",
    name: "Weekly digest",
    audience: "Newsletter",
    render: () =>
      renderDigest(
        {
          closedWeekLabel: "Week 43, 2026",
          newWeekLabel: "Week 44, 2026",
          winners: [
            {
              name: "Kaptn",
              tagline: "Changelogs your users actually read",
              url: url("/p/kaptn"),
              logoUrl: null,
              applause: 412,
              place: 1,
            },
            {
              name: "Ledgerly",
              tagline: "Bookkeeping for one-person companies",
              url: url("/p/ledgerly"),
              logoUrl: url("/icons/icon-192.png"),
              applause: 377,
              place: 2,
            },
            {
              name: "Stackwise",
              tagline: "See what every SaaS seat costs you",
              url: url("/p/stackwise"),
              logoUrl: null,
              applause: 301,
              place: 3,
            },
          ],
          sponsor: {
            bookingId: "sample",
            name: "Formcrate",
            tagline: "Forms that send straight to your Notion",
            url: url("/advertise"),
            logoUrl: null,
          },
          debutingNow: [
            {
              name: "Pagepulse",
              tagline: "Uptime checks with a status page included",
              url: url("/p/pagepulse"),
              logoUrl: null,
              featured: true,
            },
            {
              name: "Quillbase",
              tagline: "A writing inbox for your team's drafts",
              url: url("/p/quillbase"),
              logoUrl: null,
              featured: false,
            },
          ],
          topOfWeek: [
            {
              name: "Tallyfox",
              tagline: "Count anything, from any app",
              url: url("/p/tallyfox"),
              logoUrl: null,
              applause: 188,
            },
          ],
          siteUrl: url("/"),
        },
        url("/newsletter/unsubscribe?token=sample"),
      ),
  },
];
