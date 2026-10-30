import { z } from "zod";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { attachmentUrl } from "@/lib/support/service";

/** Staff only: sends the browser to Resend's short-lived download link for a received attachment. */
export async function GET(_request: Request, ctx: RouteContext<"/admin/email/attachment/[messageId]/[attachmentId]">) {
  const user = await getCurrentUser();
  if (!(await isStaff(user))) return new Response("Not allowed", { status: 403 });
  const { messageId, attachmentId } = await ctx.params;
  if (!z.string().uuid().safeParse(messageId).success) return new Response("Not found", { status: 404 });
  const url = await attachmentUrl(messageId, attachmentId);
  if (!url) return new Response("Not found", { status: 404 });
  return Response.redirect(url, 302);
}
