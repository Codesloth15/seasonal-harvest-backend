# Bugs and Known Issues

Last reviewed: September 1, 2026

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

Current audit: 4 active entries, all open.

| State | Bugs | What is needed |
|---|---|---|
| Code fix needed | `BUG-009`, `BUG-010`, `BUG-012` | Implement collision-safe SKU generation, route-specific auth throttling, and real Supabase integration tests |
| Configuration fix needed | `BUG-011` | Configure `FRONTEND_URL` and the matching Supabase recovery redirect allowlist |

| ID | Severity | Area | Problem | Status | Required action |
|---|---|---|---|---|---|
| `BUG-009` | Medium | Products | SKU generation can calculate the same sequence during concurrent product creation | `OPEN` | Generate the sequence atomically or retry safely when the unique constraint rejects a collision |
| `BUG-010` | Medium | Authentication | Authentication routes only use the global Arcjet limit and do not have stricter per-route throttling | `OPEN` | Add dedicated limits for sign-in, sign-up, forgot-password, and reset-password without weakening the global policy |
| `BUG-011` | Medium | Password recovery | Password-reset delivery can fail or redirect incorrectly when `FRONTEND_URL` and Supabase redirect URLs are not configured consistently | `OPEN` | Configure the production frontend URL and allow `<FRONTEND_URL>/reset-password` in Supabase Auth |
| `BUG-012` | Medium | Testing | Database RLS behavior is checked through migration text but not through integration tests against a real test database | `OPEN` | Add authenticated integration tests for profile reads, admin role checks, product mutations, and forbidden roles |

## Resolved bugs

Current audit: 11 bugs are resolved in the tracker.

| ID | Severity | Area | Problem | Status | Resolution |
|---|---|---|---|---|---|
| `BUG-001` | Critical | Authentication | Supabase sign-up returned `500 Database error saving new user` because the Auth trigger referenced a missing or incorrectly resolved `profiles` relation | `RESOLVED` | Migrations now create `public.profiles`; `20260728000004_fix_profile_signup_trigger.sql` uses a restricted security-definer trigger and fully qualified table name |
| `BUG-002` | Critical | Supabase RLS | PostgreSQL `42P17`: infinite recursion in policies for `profiles` | `RESOLVED` | The profile-RLS repair migration was applied and verified in the active Supabase project |
| `BUG-003` | High | Products | Product deletion returned HTTP 500 because its role check reached the recursive profile policy | `RESOLVED` | Product deletion was verified after deploying the profile-RLS repair |
| `BUG-004` | High | Routing | Inventory report routes could be interpreted as the dynamic `/:id` route | `RESOLVED` | Static report routes are registered before `/:id` |
| `BUG-005` | High | Authorization | Inventory writes did not consistently pass the caller's access token to the Supabase client used for RLS | `RESOLVED` | Controller, service, and repository paths now use an authenticated Supabase client |
| `BUG-006` | Medium | Deployment | The server port could be hard-coded or accepted without strict validation | `RESOLVED` | `server.js` reads Railway's `PORT`; `utils/port.js` validates the integer range |
| `BUG-007` | High | CORS | Allowed origins were embedded in application code and could drift between environments | `RESOLVED` | `CORS_ORIGINS` is required and strictly validated by `config/cors.js` |
| `BUG-008` | High | Inventory | Stock adjustment previously used a concurrency-unsafe read-then-write operation | `RESOLVED` | `adjust_inventory_stock` locks the balance, converts package units, validates available stock, updates quantity, and writes the ledger atomically |
| `BUG-013` | Medium | Security | Some feature routes could have bypassed Arcjet if security were mounted separately on individual routers | `RESOLVED` | Arcjet is mounted once at `/api/v1` before every feature router and its decisions are unit tested |
| `BUG-014` | High | Product images | Base64 image JSON exceeded the backend request limit | `RESOLVED` | Storage policies were applied and the verified frontend now sends the original file through the multipart `image` field |
| `BUG-015` | Medium | Brands | Brand deletion returned success but retained the Supabase row | `RESOLVED` | Permanent deletion was deployed and verified, including foreign-key protection for referenced brands |

## Diagnostic history

| ID | Area | Report | Classification | Explanation |
|---|---|---|---|---|
| `OBS-001` | Authentication | `Invalid email or password` with HTTP 401 | `NOT A BUG` | Expected secure response for invalid credentials; it intentionally does not reveal whether an account exists |
| `OBS-002` | Arcjet | Development warning about using `127.0.0.1` when no public IP is present | `NOT A BUG` | Expected during local development; production behind Railway should forward the public client IP correctly |
| `OBS-003` | Frontend | Browser console only reports `500 Internal Server Error` | `NOT A BUG` | The browser message is a symptom. Use Network > Response and backend logs to identify the underlying database or application error |
| `OBS-004` | Product images | A product request containing a Base64 image reports `413 Payload Too Large`, sometimes accompanied by a browser CORS warning | `RESOLVED` | The frontend now sends a multipart `File`; CORS runs before JSON parsing so legacy parser errors still receive CORS headers. |

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
