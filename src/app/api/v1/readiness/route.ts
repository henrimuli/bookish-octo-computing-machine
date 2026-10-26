import { api, preflight } from "@/lib/api/http";
import { readiness } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function POST(request: Request) {
  return api(request, ({ body, user, clientKey }) =>
    readiness(body as { url: string }, { user, clientKey, source: "api" }),
  );
}
