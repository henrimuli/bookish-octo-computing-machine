# Inbound email worker

Receives mail for `{key}@INBOUND_EMAIL_DOMAIN` (one address per submission order), parses it and POSTs it to the app's `/api/inbound`, signed with `INBOUND_SECRET`. Messages show up in the ops console on `/admin/submissions/[id]`.

## Deploy

1. In Cloudflare, add the inbound domain (e.g. `submit.debutyard.com`) and turn on **Email Routing**.
2. `cd workers/inbound-email && pnpm install && npx wrangler secret put INBOUND_SECRET`, then set `INBOUND_URL` in `wrangler.toml` and run `pnpm deploy`.
3. In Email Routing, add a **catch-all** rule: action "Send to a Worker", worker `debutyard-inbound-email`.
4. In Vercel, set `INBOUND_EMAIL_DOMAIN=submit.debutyard.com` and the same `INBOUND_SECRET`.

Signature: `X-Inbound-Timestamp` (unix seconds) and `X-Inbound-Signature` = hex HMAC-SHA256 of `"{timestamp}.{body}"`. The app refuses posts more than 5 minutes off.
