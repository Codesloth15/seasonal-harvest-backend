# Backend Feature Progress

Last reviewed: July 31, 2026

## Status definitions

| Status | Meaning |
|---|---|
| `DONE` | Implemented and connected to the running application |
| `PARTIAL` | Some usable implementation exists, but required integration, infrastructure, or deployment verification is still outstanding |
| `NONE` | Not implemented, not connected, or not ready for use |

A source file by itself does not qualify as `DONE`. The feature must be mounted, have its required dependencies and infrastructure, and be usable through the current application architecture.

Confirmed defects and technical risks are tracked separately in `BUGS.md`.

## Progress summary

| Area | Done | Partial | None |
|---|---:|---:|---:|
| Application foundation | 11 | 0 | 1 |
| Authentication and security | 13 | 0 | 9 |
| Inventory | 10 | 0 | 3 |
| Products | 9 | 1 | 2 |
| Brands | 8 | 0 | 2 |
| Categories | 8 | 0 | 2 |
| Users and roles | 5 | 0 | 6 |
| Orders and fulfillment | 0 | 0 | 10 |
| Notifications and workflows | 0 | 0 | 6 |
| Quality and operations | 4 | 0 | 11 |
| **Total** | **68** | **1** | **52** |

The counts are a planning snapshot and should be updated whenever a feature changes status.

## Application foundation

| Feature | Status | Evidence or required work |
|---|---|---|
| Express application composition | `DONE` | `app.js` configures middleware, routes, health checks, and errors without opening a port |
| Process startup separation | `DONE` | `server.js` owns dependency readiness, port binding, and process signals |
| Controller-service-repository boundaries | `DONE` | Active catalog and inventory modules use explicit delivery, use-case, and persistence layers |
| JSON request parsing | `DONE` | Global Express JSON middleware is enabled |
| Development CORS | `DONE` | Local frontend origins are allowed |
| Environment-specific configuration | `DONE` | `.env.<NODE_ENV>.local` is loaded by `config/env.js` |
| Central error response middleware | `DONE` | `error.middleware.js` returns JSON errors |
| Environment-based CORS allowlist | `DONE` | `CORS_ORIGINS` is required, parsed, deduplicated, and strictly validated |
| Strict environment port validation | `DONE` | Startup requires an environment `PORT` integer between 1 and 65535; Railway injects it in production |
| Request body size limits | `DONE` | JSON request bodies are limited to 100 KB |
| API version lifecycle policy | `NONE` | Document version compatibility and deprecation rules |
| Graceful shutdown | `DONE` | `server.js` handles SIGTERM and SIGINT without coupling startup to the app |

## Authentication and security

| Feature | Status | Evidence or required work |
|---|---|---|
| Supabase account sign-up | `DONE` | `POST /api/v1/auth/sign-up` |
| Supabase email/password sign-in | `DONE` | `POST /api/v1/auth/sign-in` |
| Forgot-password email request | `DONE` | `POST /api/v1/auth/forgot-password` |
| Password update with recovery token | `DONE` | `POST /api/v1/auth/reset-password` |
| Current authenticated user | `DONE` | `GET /api/v1/auth/me` |
| Global sign-out request | `DONE` | `POST /api/v1/auth/sign-out` |
| Supabase bearer-token validation | `DONE` | `auth.middleware.js` calls `supabase.auth.getUser(token)` |
| Generic invalid-login response | `DONE` | Login does not reveal whether the email exists |
| Global Arcjet protection | `DONE` | `/api/v1` mounts Arcjet before every feature router, so all API reads and writes use Shield, bot detection, and token-bucket rules; allow, rate-limit, bot, and Shield decisions are unit tested |
| Password minimum length validation | `DONE` | Sign-up and reset require at least 8 characters |
| Frontend password-reset URL | `NONE` | Set `FRONTEND_URL` in development and production environments |
| Supabase reset redirect allowlist | `NONE` | Allow `<FRONTEND_URL>/reset-password` in Supabase Auth settings |
| Role authorization middleware | `DONE` | Active profiles and allowed roles are enforced by reusable middleware |
| Protected product mutations | `DONE` | POST/PUT/DELETE require active admin or super-admin roles |
| Protected brand mutations | `DONE` | POST/PUT/DELETE require active admin or super-admin roles |
| Route-specific login throttling | `NONE` | Add stricter limits for sign-in, sign-up, and recovery endpoints |
| Strong password policy | `NONE` | Add breached/common-password checks and an agreed policy |
| Multi-factor authentication | `NONE` | Add enrollment, verification, recovery, and enforcement rules |
| Refresh-session API contract | `NONE` | Define frontend Supabase refresh behavior or a backend endpoint |
| Authentication audit events | `NONE` | Record login success/failure, recovery, password change, and logout |
| Security headers | `NONE` | Add and configure Helmet or equivalent response headers |
| CSRF protection for cookie auth | `NONE` | Required if browser authentication moves to cookies |

## Inventory

| Feature | Status | Evidence or required work |
|---|---|---|
| List inventory | `DONE` | `GET /api/v1/inventory` |
| Get inventory item | `DONE` | `GET /api/v1/inventory/:id` |
| Create inventory item | `DONE` | Authenticated POST forwards the caller token through service and repository layers |
| Update inventory item | `DONE` | Authenticated PUT forwards the caller token for ownership RLS |
| Adjust stock | `DONE` | Authenticated PATCH endpoint prevents negative stock |
| Soft-delete inventory item | `DONE` | Authenticated DELETE sets `deleted_at` |
| Inventory table migration | `DONE` | Migration includes constraints, indexes, and timestamps |
| Inventory ownership RLS | `DONE` | Select/insert/update/delete policies are committed |
| Reachable summary report route | `DONE` | Static report route is registered before `/:id` |
| Reachable low-stock route | `DONE` | Static report route is registered before `/:id` |
| Atomic stock adjustment | `NONE` | Replace read-then-write logic with a transaction/RPC to prevent races |
| Stock movement ledger | `NONE` | Record every adjustment with actor, reason, quantity, and timestamp |
| Pagination | `NONE` | Add validated limit/cursor behavior for inventory lists |

## Products

| Feature | Status | Evidence or required work |
|---|---|---|
| Create product handler | `DONE` | Product controller and model support creation |
| List products | `DONE` | Filtering, searching, and sorting are implemented |
| Get product | `DONE` | Single-product lookup is implemented |
| Update product | `DONE` | Allowed-field filtering and price validation are implemented |
| Permanently delete product | `DONE` | Admin-protected delete removes the product row |
| Product type validation | `DONE` | Supports `BRANDED` and `UNBRANDED` |
| SKU generation | `DONE` | `sku.service.js` generates a brand/product sequence |
| Product table migration | `DONE` | Schema, constraints, indexes, RLS, grants, and timestamps are committed |
| Product write authorization | `DONE` | Mutations use authenticated clients and admin role enforcement |
| Collision-safe SKU generation | `NONE` | Add a unique constraint and atomic sequence/retry behavior |
| Product pagination | `NONE` | Add validated limit/cursor behavior |
| Product image upload | `PARTIAL` | The admin-protected create route accepts one `image` multipart field, validates JPEG/PNG/WebP/AVIF and a 5 MB limit, uploads to `product-images/{product-id}/{generated-filename}`, saves the public URL in `image_url`, rolls back failed creates, and returns actionable upload errors. Unit tests pass; apply the storage-policy migration, switch the frontend away from Base64 JSON, and verify against the target Supabase project before marking `DONE`. |

## Brands

| Feature | Status | Evidence or required work |
|---|---|---|
| Create brand handler | `DONE` | Brand controller and model support creation |
| List brands | `DONE` | Search, active filter, and sorting are implemented |
| Get brand | `DONE` | Single-brand lookup is implemented |
| Update brand | `DONE` | Allowed-field filtering is implemented |
| Permanently delete brand | `DONE` | Admin-protected `DELETE /api/v1/brands/:id` issues a Supabase hard delete; referenced brands are protected by `ON DELETE RESTRICT` |
| Brand input validation | `DONE` | A trimmed name is required for creation |
| Brand table migration | `DONE` | Schema, uniqueness, indexes, RLS, grants, and timestamps are committed |
| Brand write authorization | `DONE` | Mutations use authenticated clients and admin role enforcement |
| Duplicate brand prevention | `NONE` | Enforce normalized case-insensitive uniqueness in PostgreSQL |
| Brand logo upload | `NONE` | Add secure storage and file validation |

## Categories

| Feature | Status | Evidence or required work |
|---|---|---|
| List categories | `DONE` | Public `GET /api/v1/categories` with search and sorting |
| Get category | `DONE` | Public `GET /api/v1/categories/:id` |
| Create category | `DONE` | Admin-protected POST endpoint |
| Update category | `DONE` | Admin-protected PUT endpoint |
| Delete category | `DONE` | Admin-protected DELETE endpoint |
| Category table migration | `DONE` | Fields, constraints, indexes, and timestamp trigger are committed |
| Category RLS | `DONE` | Public reads and admin-only writes are enforced in PostgreSQL |
| Category unit tests | `DONE` | Controller, model, and role middleware behavior are tested |
| Category pagination | `NONE` | Add validated limit/cursor behavior if the category count grows |
| Category soft deletion | `NONE` | Decide whether referenced categories should be disabled instead of deleted |

## Users and roles

| Feature | Status | Evidence or required work |
|---|---|---|
| Profile table migration | `DONE` | Supabase `profiles` table extends Auth users; recursive role policies are repaired with restricted security-definer helpers |
| Employee/admin/super-admin roles | `DONE` | `user_role` enum is committed |
| Automatic profile creation | `DONE` | Auth-user trigger inserts a profile |
| Current profile API | `NONE` | Return application profile and role alongside Auth identity |
| User administration API | `NONE` | List, view, activate, and deactivate users securely |
| Role assignment API | `NONE` | Super-admin-only role changes with audit records |
| Express role enforcement | `DONE` | Category mutations require admin or super-admin roles |
| Profile update API | `NONE` | Allow validated updates to permitted personal fields |
| Account deletion flow | `NONE` | Define soft deletion, retention, and Auth-user removal |
| User search and pagination | `NONE` | Add admin-only validated querying |
| Legacy MongoDB/Upstash cleanup | `DONE` | Unmounted routes, controllers, models, config, and unused dependencies were removed |

## Orders and fulfillment

| Feature | Status | Required work |
|---|---|---|
| Order database schema | `NONE` | Add orders and immutable order-item snapshots |
| Create order | `NONE` | Validate products, prices, stock, and customer identity |
| List customer orders | `NONE` | Enforce per-user visibility and pagination |
| Admin order list | `NONE` | Add role-protected filters and pagination |
| Order detail | `NONE` | Enforce customer ownership or staff access |
| Order status workflow | `NONE` | Define allowed state transitions |
| Atomic stock reservation | `NONE` | Prevent overselling during concurrent orders |
| Cancellation and stock release | `NONE` | Define safe cancellation rules and inventory restoration |
| Payment integration | `NONE` | Select provider and implement verified webhooks/idempotency |
| Fulfillment audit trail | `NONE` | Record every status change and actor |

## Notifications and workflows

| Feature | Status | Required work |
|---|---|---|
| Transactional email provider | `NONE` | Configure a provider and verified sender domain |
| Welcome or verification messaging | `NONE` | Configure Supabase templates and branding |
| Low-stock notifications | `NONE` | Add thresholds, recipients, deduplication, and scheduling |
| Order notifications | `NONE` | Notify users on confirmed status transitions |
| Working background workflow integration | `NONE` | Design a Supabase-compatible background job system when required |
| Delivery retry and failure tracking | `NONE` | Add idempotent retry behavior and operational visibility |

## Quality and operations

| Feature | Status | Evidence or required work |
|---|---|---|
| ESLint configuration | `DONE` | ESLint is configured and authentication files pass linting |
| Versioned Supabase migrations | `DONE` | Inventory, catalog, auth/role, RLS repair, and product-image Storage migrations are committed |
| Automated unit tests and coverage | `DONE` | 103 Vitest tests pass, including product-image upload and error-response behavior, with enforced statement, branch, function, and line thresholds |
| API integration tests | `NONE` | Test authentication, authorization, CRUD, RLS, and errors |
| End-to-end frontend/backend tests | `NONE` | Cover registration, login, recovery, and main business flows |
| CI pipeline | `NONE` | Run lint, tests, migration checks, and secret scanning |
| API schema/OpenAPI | `NONE` | Publish machine-readable request and response contracts |
| Health endpoint | `DONE` | Public `/health` endpoint supports Railway deployment health checks |
| Structured logging | `NONE` | Add request IDs and machine-readable security-aware logs |
| Error monitoring | `NONE` | Configure alerting without exposing secrets or personal data |
| Metrics and alerting | `NONE` | Track latency, errors, auth failures, and rate limits |
| Backup and restore verification | `NONE` | Document and regularly test recovery procedures |
| Dependency vulnerability scanning | `NONE` | Add automated audit and update policy |
| Secret scanning | `NONE` | Scan commits and rotate any exposed credentials |
| Deployment runbook | `NONE` | Document configuration, migrations, rollback, and incident steps |

## Security-first implementation order

Work should proceed in this order:

1. Configure `FRONTEND_URL` and Supabase recovery redirects.
2. Apply and verify the profile-RLS repair and product-image Storage migrations in the target Supabase project.
3. Switch product creation in the frontend from Base64 JSON to the admin-authenticated multipart `image` flow.
4. Make stock updates atomic and make SKU generation collision-safe.
5. Add authentication, authorization, Storage-policy, and RLS integration tests.
6. Add security headers, stricter auth throttling, structured audit events, and secret scanning.
7. Build users/roles administration.
8. Build orders with transactional stock reservation and idempotent payment handling.
9. Add notifications, observability, backup verification, and deployment automation.

## Rules for updating this file

- Change a feature to `DONE` only after it is implemented, connected, and verified.
- Leave a feature as `NONE` when it is only planned, stubbed, unmounted, or missing infrastructure.
- Add evidence such as a route, migration, test, or configuration reference.
- Review authentication, authorization, data exposure, RLS, rate limiting, and audit requirements for every new feature.
- Update the summary counts whenever a status changes.
