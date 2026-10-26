import { unsubscribe } from "@/lib/newsletter/service";

/** RFC 8058 one-click unsubscribe: mail clients POST here straight from the inbox. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length > 64) return new Response("Bad request", { status: 400 });
  await unsubscribe(token);
  return new Response("Unsubscribed", { status: 200 });
}
