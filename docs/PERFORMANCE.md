# API performance

## Measured baseline (22 October 2026)

Sequential read-only requests to `https://seasonal-harvest-backend.onrender.com`
showed the following. These are a small sample from the development machine,
not production percentiles or a guarantee of user latency.

| Endpoint | Observed total time | Decoded JSON bytes |
| --- | --- | --- |
| `/health` | 0.36–0.73 s | 35 |
| `/api/v1/products` | 2.70–4.22 s | 1,226,615 |
| `/api/v1/categories` | 1.18–1.60 s | 2,592 |
| `/api/v1/brands` | 0.81–1.28 s | 3,315 |

The 58 products include **22 embedded data-URL images**. `image_url` fields
account for 1,192,933 bytes, about 97% of the response. Replacing embedded
images with short Storage URLs estimates roughly 35 KB of catalog JSON;
the actual result depends on the resulting URL lengths. Image bytes are then
fetched separately and cached by image clients. This also reduces the data
Supabase sends to Render, including inventory/analytics responses joining products.

Render's edge already returned Brotli (`Content-Encoding: br`). Keep compression
at the edge; it does not eliminate the embedded-image cost.

Each API request also awaits Arcjet; product reads include a separate catalog
rate-limit check. Protected routes call Supabase Auth. Admin routes additionally
read the profile before querying data. Request timing is needed to attribute
these delays precisely; public response timings alone cannot identify them.

## Changes

- New inline images on product creation/update are uploaded to the existing
  `product-images` bucket. Only their public URL is saved. Multipart uploads and
  existing external image URLs retain their behavior.
- Concurrent requests with the same bearer token share one pending Auth lookup.
  Results/errors are discarded immediately after settlement; later requests
  revalidate with Supabase, preserving live user checks.
- The performance migration adds global transaction-date and inventory-date
  indexes and evaluates caller-only RLS helper functions once per statement.
- API responses include `Server-Timing` and `X-Request-ID`. Slow requests emit
  JSON logs with route templates, status, durations and dependency-call counts.
  Request bodies, query strings, bearer tokens and image data are excluded.

`Server-Timing` measures `arcjet`, `catalog_rate_limit`, `auth`, `role`,
`supabase`, and `total` when those stages run. Supabase fetch measurements end
when upstream response headers arrive; `auth` and `role` include the complete
operation. Durations can overlap (parallel queries and nested auth fetches), so
they must not be added together. `total` ends when response headers are written;
the slow log includes full response completion for ordinary JSON requests.
Set `SLOW_REQUEST_MS` in Render (default `1000`) to adjust the logging threshold.

## Deployment and existing image cleanup

1. Deploy the backend changes using the updated lockfile. Set Render's health
   check path to `/health`.
2. Apply `supabase/migrations/20261022000001_optimize_api_query_paths.sql`
   using the existing Supabase migration process. It uses ordinary index
   creation; schedule a quiet write window. See the migration README for the
   local policy-equivalence regression test.
3. Preview existing images with `npm run migrate:product-images`. This defaults
   to a read-only dry run against the Supabase environment selected by
   `NODE_ENV` and `config/env.js`.
4. To migrate existing images, provide an active admin's access token in
   `PRODUCT_IMAGE_MIGRATION_TOKEN` through the shell environment, then run
   `npm run migrate:product-images -- --apply`. Do not put the token in command
   arguments or commit it. The tool uses the admin's RLS context, uploads each
   image, replaces the database value only if `updated_at` is unchanged, and
   checks the database before removing uploads after an uncertain update result.
   It prints counts and byte totals. Review failures and retained uploads before
   rerunning; completed rows are skipped.
5. Compare `npm run benchmark:api -- --base-url https://seasonal-harvest-backend.onrender.com`
   before/after cleanup. Inspect `Server-Timing` and matching Render slow logs
   to distinguish security, auth, database, and network time.

Production has not been redeployed or modified by this work. The image cleanup
and SQL migration require execution in the intended environment.

## Hosting and remaining work

The Render plan and region have not been verified. On a Free service, Render
spins down after 15 minutes without inbound traffic and the next spin-up takes
about a minute. Warm samples do not rule out that separate cold-start delay.
For consistently responsive first requests, use an always-running paid service.
Place Render near the Supabase project and users; check both regions before
changing hosting.

The app also amplifies backend work: it refreshes auth on every foreground
event and reloads several mounted screens; Home downloads full product and
category lists to count them. Follow-up client work should refresh only near
expiry, share catalog results and use compact dashboard counts.

Dashboard/movement analytics currently load raw rows and aggregate them in Node.
Supabase's default row limit can truncate large datasets. A follow-up should
move aggregation into an RLS-preserving SQL function, rather than increase the
row limit or cache potentially stale inventory counts.

References: [Render Free services](https://render.com/docs/free),
[Render regions](https://render.com/docs/regions),
[Render health checks](https://render.com/docs/health-checks),
[Supabase RLS helper optimization](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select),
[Supabase row limits](https://supabase.com/docs/reference/javascript/select).
