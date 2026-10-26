import { api, preflight } from "@/lib/api/http";
import { draftSubmission } from "@/lib/api/operations";

export const OPTIONS = preflight;

/** Creates a draft listing. It isn't submitted: the maker finishes it in the browser. */
export async function POST(request: Request) {
  return api(request, ({ body, user }) => draftSubmission(body, user, "api"));
}
