import { api, preflight } from "@/lib/api/http";
import { myLinks } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function GET(request: Request) {
  return api(request, ({ user }) => myLinks(user));
}
