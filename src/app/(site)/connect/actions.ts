"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { checkAuthorize, createAuthCode, type AuthorizeRequest } from "@/lib/api/oauth";
import { buildRedirect } from "@/lib/api/oauth-rules";

function readRequest(form: FormData): AuthorizeRequest & { state?: string } {
  const get = (k: string) => String(form.get(k) ?? "");
  return {
    clientId: get("client_id"),
    redirectUri: get("redirect_uri"),
    responseType: get("response_type"),
    codeChallenge: get("code_challenge"),
    codeChallengeMethod: get("code_challenge_method"),
    state: form.get("state") === null ? undefined : get("state"),
  };
}

export async function approveConnect(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const req = readRequest(form);
  const code = await createAuthCode(user.id, req);
  redirect(buildRedirect(req.redirectUri, { code, state: req.state }));
}

export async function denyConnect(form: FormData) {
  const req = readRequest(form);
  // Only send people back to a redirect the client registered.
  const checked = await checkAuthorize(req);
  if ("fatal" in checked) redirect("/dashboard/api");
  redirect(buildRedirect(req.redirectUri, { error: "access_denied", state: req.state }));
}
