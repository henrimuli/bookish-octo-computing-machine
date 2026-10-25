import "server-only";
import { env } from "@/env";
import { site } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { registerFulfillment } from "./fulfillment";
import { formatUsd, getSku } from "./skus";

/**
 * Submission packages are delivered by hand. Until the Phase 3 intake form and
 * ops console exist, a paid order emails the buyer (what happens next) and the
 * team (who to contact).
 */
registerFulfillment("submission", async (order) => {
  const sku = getSku(order.sku);
  const name = sku?.name ?? order.sku;
  const amount = formatUsd(order.amountCents);

  await sendEmail({
    to: order.email,
    subject: `Your ${site.name} order: ${name}`,
    text: [
      `Thanks for your order (${name}, ${amount}).`,
      "",
      "Within 24 hours we'll email you a short form for your product details (logo, screenshots, descriptions, categories).",
      "Submissions start within 48 hours of receiving them, and you'll get a live report with every listing's link and status.",
      "",
      `Order reference: ${order.id}`,
      `Questions? Reply to this email or write to ${site.supportEmail}.`,
    ].join("\n"),
    html: `<p>Thanks for your order (<strong>${name}</strong>, ${amount}).</p>
<p>Within 24 hours we'll email you a short form for your product details (logo, screenshots, descriptions, categories). Submissions start within 48 hours of receiving them, and you'll get a live report with every listing's link and status.</p>
<p>Order reference: <code>${order.id}</code><br>Questions? Reply to this email or write to ${site.supportEmail}.</p>`,
  });

  await sendEmail({
    to: env().ADMIN_EMAIL ?? site.supportEmail,
    subject: `New submission order: ${name} (${amount})`,
    text: `Buyer: ${order.email}\nPackage: ${name}\nPaid: ${amount} via ${order.provider}\nOrder: ${order.id}`,
    html: `<p>Buyer: ${order.email}<br>Package: ${name}<br>Paid: ${amount} via ${order.provider}<br>Order: <code>${order.id}</code></p>`,
  });
});
