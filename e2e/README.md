# End-to-end tests (Playwright)

## Run

```bash
npm run test:e2e
```

Optional:

- `npm run test:e2e:ui` — interactive UI mode
- `npm run test:e2e:report` — open HTML report after a run

## Environment

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Target app URL (e.g. Vercel preview). Skips starting a local web server. |
| `PLAYWRIGHT_SKIP_WEB_SERVER=1` | Do not start `npm run dev`; use an already-running server at `http://localhost:3000`. |
| `PLAYWRIGHT_WEB_SERVER_COMMAND` | Override dev server command (default: `npm run dev`). |

The app needs the same env as local dev (`.env.local`): Supabase URL/keys, storage buckets, and optionally `GOOGLE_MAPS_SERVER_KEY` / Resend for full submit side effects.

## Fixtures

Committed under `e2e/fixtures/`:

- `listing-photos/photo-{1,2,3}.png` — tiny 1×1 PNGs for the 3-photo minimum
- `verification/valid-id.png`, `proof-billing.png` — landlord verification uploads

No extra image files are required.

## Known breakpoint (current)

If the test fails with **“Could not reach the server”** and the dev server never logs `POST /api/dormspaces/submit`, the submit handler is likely throwing when building `FormData` from `e.currentTarget` after `await compressListingPhotos()` (React nulls `currentTarget` after the first `await` in an event handler). Capture the form element before any `await` in `dormspace-submit-form.tsx` `handleSubmit`.
