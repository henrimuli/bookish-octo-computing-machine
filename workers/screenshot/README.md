# Screenshot worker

Takes two kinds of screenshots, as 1280×900 PNGs in the same R2 bucket the app uses:

- **Listing screenshots:** when a maker fetches their website in the debut form, the homepage is captured into the first Screenshots slot (`screenshots/<uuid>.png`, saved to `product_media` with the listing).
- **Evidence:** directory listings when they're first confirmed live (`verifySubmission`) and whenever Link Monitor sees a change (turned nofollow, removed, recovered). The URL is stored on the check and in `submissions.evidence_url`.

Playwright doesn't run on Vercel functions, so this is a small container.

## API

`POST /screenshot` with `Authorization: Bearer $WORKER_SECRET` and `{ "url": "https://…", "key": "evidence/<id>/<timestamp>.png" }` → `{ "url": "https://<R2_PUBLIC_URL>/<key>" }`. `GET /health` for the host's health check. Private and internal addresses are refused, including on redirects and subresources.

## Deploy (Railway or Fly)

1. Create a service from this folder (it has a `Dockerfile`). On Fly: `fly launch --no-deploy` here, then `fly deploy`.
2. Set `WORKER_SECRET` (`openssl rand -hex 32`) and the R2 settings: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
3. In Vercel, set `WORKER_URL` (the service's https URL) and the same `WORKER_SECRET`.

Without `WORKER_URL`, the app skips screenshots and staff can still paste an evidence URL by hand.
