# Bugs and Known Issues

Last reviewed: July 31, 2026

This file is the single tracker for defects, production errors, and confirmed technical risks. Feature work that has not produced incorrect behavior belongs in `PROGRESS.md` instead.

## Status definitions

| Status | Meaning |
|---|---|
| `OPEN` | Confirmed problem that still needs a code or database fix |
| `FIX READY` | Fixed in the repository but not yet verified in the deployed environment |
| `BLOCKED` | Cannot be completed until another issue or external action is resolved |
| `RESOLVED` | Fixed, tested, and verified where it runs |
| `NOT A BUG` | Reported behavior is expected; retained for diagnostic history |

## Active bugs

Current audit: 9 active entries — 3 fixes ready for deployment verification,
1 blocked by a pending migration, and 5 still open.

| State | Bugs | What is needed |
|---|---|---|
| Repository fix ready | `BUG-002`, `BUG-014`, `BUG-015` | Apply the relevant Supabase migrations or code deployment and verify the original requests in the deployed environment; `BUG-014` also requires the frontend multipart change |
| Blocked | `BUG-003` | Verify product deletion after `BUG-002` is deployed |
| Code fix needed | `BUG-008`, `BUG-009`, `BUG-010`, `BUG-012` | Implement atomic stock changes, collision-safe SKU generation, route-specific auth throttling, and real Supabase integration tests |
| Configuration fix needed | `BUG-011` | Configure `FRONTEND_URL` and the matching Supabase recovery redirect allowlist |

| ID | Severity | Area | Problem | Status | Required action |
|---|---|---|---|---|---|
| `BUG-002` | Critical | Supabase RLS | PostgreSQL `42P17`: infinite recursion in policies for `profiles` | `FIX READY` | Apply migration `20260728000005_fix_profiles_rls_recursion.sql` to the active Supabase project, verify policies, sign in again, and retry the protected request |
| `BUG-003` | High | Products | Product deletion returns HTTP 500 because its role check reads `profiles` and reaches `BUG-002` | `BLOCKED` | Resolve `BUG-002`, then verify `DELETE /api/v1/products/:id` returns success and removes the product row |
| `BUG-008` | High | Inventory | Stock adjustment uses a read-then-write operation and can lose updates under concurrent requests | `OPEN` | Replace it with one PostgreSQL transaction or RPC that checks and updates stock atomically |
| `BUG-009` | Medium | Products | SKU generation can calculate the same sequence during concurrent product creation | `OPEN` | Generate the sequence atomically or retry safely when the unique constraint rejects a collision |
| `BUG-010` | Medium | Authentication | Authentication routes only use the global Arcjet limit and do not have stricter per-route throttling | `OPEN` | Add dedicated limits for sign-in, sign-up, forgot-password, and reset-password without weakening the global policy |
| `BUG-011` | Medium | Password recovery | Password-reset delivery can fail or redirect incorrectly when `FRONTEND_URL` and Supabase redirect URLs are not configured consistently | `OPEN` | Configure the production frontend URL and allow `<FRONTEND_URL>/reset-password` in Supabase Auth |
| `BUG-012` | Medium | Testing | Database RLS behavior is checked through migration text but not through integration tests against a real test database | `OPEN` | Add authenticated integration tests for profile reads, admin role checks, product mutations, and forbidden roles |
| `BUG-014` | High | Product images | The frontend can encode an image as Base64 inside the JSON `image_url` field, making the request exceed the backend's 100 KB JSON limit and return `413 Payload Too Large` | `FIX READY` | Backend multipart upload, MIME/size validation, specific upload errors, CORS-before-parser ordering, rollback behavior, and unit tests are ready. Send the actual file as the `image` field, apply `20260729000001_create_product_image_storage_policies.sql`, and verify upload to `product-images/{product-id}/{generated-filename}` in the target project |
| `BUG-015` | Medium | Brands | Brand deletion returned success but retained the row in Supabase because the repository only set `is_active = false` | `FIX READY` | Deploy the repository change that issues `.delete()`, then verify an unreferenced brand is physically removed and a referenced brand is rejected by the foreign-key constraint |

## Deployment verification pending

### BUG-015 - Brand delete retained the database row

Observed behavior:

```text
DELETE /api/v1/brands/:id returned 200 "Brand deleted successfully."
The brand row remained in the Supabase brands table with is_active = false.
```

Cause: `brand.model.js` implemented deletion as an update to `is_active = false`, while the API response claimed the brand was deleted.

Repository fix:

- The authenticated Supabase query now calls `.delete()` and returns the deleted row.
- The service still returns `404` when no matching row is deleted.
- Product references remain protected by the existing `ON DELETE RESTRICT` foreign key.
- All 103 Vitest tests pass.

Still required before resolution:

1. Deploy this branch to the target backend environment.
2. Delete an unreferenced test brand and confirm its row no longer exists in `public.brands`.
3. Attempt to delete a referenced brand and confirm the database prevents orphaned products.

### BUG-002 - Recursive `profiles` policies

Observed error:

```text
code: 42P17
message: infinite recursion detected in policy for relation "profiles"
```

Cause: policies on `public.profiles` queried `public.profiles` again to determine the caller's role. PostgreSQL invoked the same RLS policies for that nested query and stopped the resulting loop.

Repository fix:

- `supabase/migrations/20260728000005_fix_profiles_rls_recursion.sql`
- Replaces nested policy queries with restricted `SECURITY DEFINER` helpers.
- Restricts the helpers to authenticated callers.
- Restricts direct profile updates to `full_name` so users cannot change `role` or `is_active`.

Apply with:

```bash
supabase db push
```

Alternatively, run that migration in Supabase Dashboard > SQL Editor. Then verify:

```sql
SELECT policyname, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;
```

The policies must use `public.is_admin_or_super_admin()` or `public.is_super_admin()` and must not contain a nested `SELECT` from `profiles`.

### BUG-014 - Base64 product image request

Repository fix:

- `POST /api/v1/products` accepts one optional multipart field named `image`.
- JPEG, PNG, WebP, and AVIF are accepted up to 5 MB.
- Known upload failures return stable error codes and actionable messages.
- Supabase Storage errors retain their detailed backend message.
- Objects use `product-images/{product-id}/{generated-filename}` and the public URL is saved in `products.image_url`.
- Failed image uploads roll back the newly created product; failed URL updates also remove the uploaded object when cleanup succeeds.
- CORS runs before JSON parsing, so an oversized legacy JSON request receives CORS headers with its 413 response.

Still required before resolution:

1. Apply `supabase/migrations/20260729000001_create_product_image_storage_policies.sql` to the target Supabase project.
2. Change the frontend to send the original `File` in `FormData` field `image`; do not send Base64 in `image_url` and do not manually set the multipart boundary.
3. Verify an admin can upload and a non-admin cannot upload.
4. Verify the returned URL loads publicly and `products.image_url` contains that URL.
5. Reproduce the former Base64 path only to confirm it is no longer used by the frontend.

## Resolved bugs

Current audit: 7 bugs are resolved in the tracker.

| ID | Severity | Area | Problem | Status | Resolution |
|---|---|---|---|---|---|
| `BUG-001` | Critical | Authentication | Supabase sign-up returned `500 Database error saving new user` because the Auth trigger referenced a missing or incorrectly resolved `profiles` relation | `RESOLVED` | Migrations now create `public.profiles`; `20260728000004_fix_profile_signup_trigger.sql` uses a restricted security-definer trigger and fully qualified table name |
| `BUG-004` | High | Routing | Inventory report routes could be interpreted as the dynamic `/:id` route | `RESOLVED` | Static report routes are registered before `/:id` |
| `BUG-005` | High | Authorization | Inventory writes did not consistently pass the caller's access token to the Supabase client used for RLS | `RESOLVED` | Controller, service, and repository paths now use an authenticated Supabase client |
| `BUG-006` | Medium | Deployment | The server port could be hard-coded or accepted without strict validation | `RESOLVED` | `server.js` reads Railway's `PORT`; `utils/port.js` validates the integer range |
| `BUG-007` | High | CORS | Allowed origins were embedded in application code and could drift between environments | `RESOLVED` | `CORS_ORIGINS` is required and strictly validated by `config/cors.js` |
| `BUG-013` | Medium | Security | Some feature routes could have bypassed Arcjet if security were mounted separately on individual routers | `RESOLVED` | Arcjet is mounted once at `/api/v1` before every feature router and its decisions are unit tested |

## Diagnostic history

| ID | Area | Report | Classification | Explanation |
|---|---|---|---|---|
| `OBS-001` | Authentication | `Invalid email or password` with HTTP 401 | `NOT A BUG` | Expected secure response for invalid credentials; it intentionally does not reveal whether an account exists |
| `OBS-002` | Arcjet | Development warning about using `127.0.0.1` when no public IP is present | `NOT A BUG` | Expected during local development; production behind Railway should forward the public client IP correctly |
| `OBS-003` | Frontend | Browser console only reports `500 Internal Server Error` | `NOT A BUG` | The browser message is a symptom. Use Network > Response and backend logs to identify the underlying database or application error |
| `OBS-004` | Product images | A product request containing a Base64 image reports `413 Payload Too Large`, sometimes accompanied by a browser CORS warning | `CONFIRMED` | Base64 expands the image and does not belong in `image_url`. The 413 response is the primary failure; send a multipart `File` instead. CORS now runs before JSON parsing so parser errors receive CORS headers. |

## New bug template

Add new entries to the active table and use the next ID.

```markdown
### BUG-000 - Short title

- Status: `OPEN`
- Severity: Critical | High | Medium | Low
- Area: feature or infrastructure
- First observed: YYYY-MM-DD
- Endpoint or operation:
- Error code and message:
- Reproduction steps:
- Expected behavior:
- Actual behavior:
- Security or data impact:
- Root cause:
- Proposed fix:
- Verification:
```

## Maintenance rules

- Never mark a database fix `RESOLVED` until its migration is applied and verified in the target environment.
- Record exact error codes, endpoints, and safe reproduction steps; never include passwords, access tokens, API keys, or personal data.
- Link every code fix to a test or verification query.
- Move an entry from active to resolved only after the original reproduction no longer fails.
- Keep planned features in `PROGRESS.md`; use this file only for incorrect behavior and concrete technical risks.
