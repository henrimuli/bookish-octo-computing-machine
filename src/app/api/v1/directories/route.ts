import { api, preflight } from "@/lib/api/http";
import { launchDirectories } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const niche = p.get("niche");
  const pricing = p.get("pricing");
  return api(request, () =>
    launchDirectories({
      niche: (niche || undefined) as "general" | undefined,
      pricing: (pricing || undefined) as "free" | undefined,
      noBadge: p.get("noBadge") === "true" || undefined,
      dofollow: p.get("dofollow") === "true" || undefined,
    }),
  );
}
