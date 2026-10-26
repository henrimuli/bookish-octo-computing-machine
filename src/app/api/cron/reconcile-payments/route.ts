import { env } from "@/env";
import { reconcilePendingOrders } from "@/lib/payments/service";

/** Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await reconcilePendingOrders();
  return Response.json(result);
}
