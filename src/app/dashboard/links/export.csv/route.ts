import { getCurrentUser } from "@/lib/auth";
import { linksCsv, linksForUser } from "@/lib/links/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  return new Response(linksCsv(await linksForUser(user.id)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="debutyard-links.csv"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
