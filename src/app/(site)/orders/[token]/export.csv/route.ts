import { orderByIntakeToken, orderRows, ordersCsv } from "@/lib/submissions/service";
import { slugify } from "@/lib/slug";

export async function GET(_request: Request, ctx: RouteContext<"/orders/[token]/export.csv">) {
  const { token } = await ctx.params;
  const order = await orderByIntakeToken(token);
  if (!order || order.status === "awaiting_intake") return new Response("Not found", { status: 404 });
  const csv = ordersCsv(await orderRows(order.id));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(order.productName ?? "order") || "order"}-directories.csv"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
