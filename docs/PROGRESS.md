# Backend Feature Progress

Last reviewed: July 28, 2026

## Status definitions

| Status | Meaning |
|---|---|
| `DONE` | Implemented and connected to the running application |
| `NONE` | Not implemented, not connected, or not ready for use |

A source file by itself does not qualify as `DONE`. The feature must be mounted, have its required dependencies and infrastructure, and be usable through the current application architecture.

## Progress summary

| Area | Done | None |
|---|---:|---:|
| Application foundation | 8 | 3 |
| Authentication and security | 10 | 12 |
| Inventory | 8 | 5 |
| Products | 7 | 5 |
| Brands | 6 | 4 |
| Users and roles | 3 | 8 |
| Orders and fulfillment | 0 | 10 |
| Notifications and workflows | 0 | 6 |
| Quality and operations | 3 | 12 |
| **Total** | **45** | **65** |

The counts are a planning snapshot and should be updated whenever a feature changes status.

## Application foundation

| Feature | Status | Evidence or required work |
|---|---|---|
| Express application startup | `DONE` | `app.js` creates and starts the server |
| JSON request parsing | `DONE` | Global Express JSON middleware is enabled |
| URL-encoded request parsing | `DONE` | Enabled globally in `app.js` |
| Cookie parsing | `DONE` | Cookie parser is installed globally |
| Development CORS | `DONE` | Local frontend origins are allowed |
| Environment-specific configuration | `DONE` | `.env.<NODE_ENV>.local` is loaded by `config/env.js` |
| Central error response middleware | `DONE` | `error.middleware.js` returns JSON errors |
| Environment-based CORS allowlist | `DONE` | `CORS_ORIGINS` is required, parsed, deduplicated, and strictly validated |
| Request body size limits | `NONE` | Define explicit JSON and form payload limits |
| API version lifecycle policy | `NONE` | Document version compatibility and deprecation rules |
| Graceful shutdown | `NONE` | Close the HTTP server and clients on termination signals |

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
| Global Arcjet protection | `DONE` | Shield, bot detection, and token-bucket rules are active |
| Password minimum length validation | `DONE` | Sign-up and reset require at least 8 characters |
| Frontend password-reset URL | `NONE` | Set `FRONTEND_URL` in development and production environments |
| Supabase reset redirect allowlist | `NONE` | Allow `<FRONTEND_URL>/reset-password` in Supabase Auth settings |
| Role authorization middleware | `NONE` | Add reusable employee/admin/super-admin permission checks |
| Protected product mutations | `NONE` | Require authentication and appropriate roles for POST/PUT/DELETE |
| Protected brand mutations | `NONE` | Require authentication and appropriate roles for POST/PUT/DELETE |
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
| Create inventory item | `DONE` | Authenticated POST endpoint and Supabase model exist |
| Update inventory item | `DONE` | Authenticated PUT endpoint exists |
| Adjust stock | `DONE` | Authenticated PATCH endpoint prevents negative stock |
| Soft-delete inventory item | `DONE` | Authenticated DELETE sets `deleted_at` |
| Inventory table migration | `DONE` | Migration includes constraints, indexes, and timestamps |
| Inventory ownership RLS | `DONE` | Select/insert/update/delete policies are committed |
| Reachable summary report route | `NONE` | Move `/reports/summary` before `/:id` in the router |
| Reachable low-stock route | `NONE` | Move `/reports/low-stock` before `/:id` in the router |
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
| Soft-disable product | `DONE` | Delete changes `is_active` to false |
| Product type validation | `DONE` | Supports `BRANDED` and `UNBRANDED` |
| SKU generation | `DONE` | `sku.service.js` generates a brand/product sequence |
| Product table migration | `NONE` | Commit the schema, constraints, indexes, RLS, and timestamps |
| Product write authorization | `NONE` | Restrict mutations to approved roles |
| Collision-safe SKU generation | `NONE` | Add a unique constraint and atomic sequence/retry behavior |
| Product pagination | `NONE` | Add validated limit/cursor behavior |
| Product image upload | `NONE` | Add secure storage, MIME/size validation, and ownership rules |

## Brands

| Feature | Status | Evidence or required work |
|---|---|---|
| Create brand handler | `DONE` | Brand controller and model support creation |
| List brands | `DONE` | Search, active filter, and sorting are implemented |
| Get brand | `DONE` | Single-brand lookup is implemented |
| Update brand | `DONE` | Allowed-field filtering is implemented |
| Soft-disable brand | `DONE` | Delete changes `is_active` to false |
| Brand input validation | `DONE` | A trimmed name is required for creation |
| Brand table migration | `NONE` | Commit schema, uniqueness, indexes, RLS, and timestamps |
| Brand write authorization | `NONE` | Restrict mutations to approved roles |
| Duplicate brand prevention | `NONE` | Enforce normalized case-insensitive uniqueness in PostgreSQL |
| Brand logo upload | `NONE` | Add secure storage and file validation |

## Users and roles

| Feature | Status | Evidence or required work |
|---|---|---|
| Profile table migration | `DONE` | Supabase `profiles` table extends Auth users |
| Employee/admin/super-admin roles | `DONE` | `user_role` enum is committed |
| Automatic profile creation | `DONE` | Auth-user trigger inserts a profile |
| Current profile API | `NONE` | Return application profile and role alongside Auth identity |
| User administration API | `NONE` | List, view, activate, and deactivate users securely |
| Role assignment API | `NONE` | Super-admin-only role changes with audit records |
| Express role enforcement | `NONE` | Protect routes using the profile role |
| Profile update API | `NONE` | Allow validated updates to permitted personal fields |
| Account deletion flow | `NONE` | Define soft deletion, retention, and Auth-user removal |
| User search and pagination | `NONE` | Add admin-only validated querying |
| Legacy Mongoose user removal/migration | `NONE` | Remove or migrate the inactive MongoDB implementation |

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
| Working background workflow integration | `NONE` | Replace or complete the inactive MongoDB/Upstash subsystem |
| Delivery retry and failure tracking | `NONE` | Add idempotent retry behavior and operational visibility |

## Quality and operations

| Feature | Status | Evidence or required work |
|---|---|---|
| ESLint configuration | `DONE` | ESLint is configured and authentication files pass linting |
| Versioned Supabase migrations | `DONE` | Inventory and auth/role migrations are committed |
| Authentication and CORS unit tests | `DONE` | 31 Vitest tests pass with enforced coverage thresholds |
| API integration tests | `NONE` | Test authentication, authorization, CRUD, RLS, and errors |
| End-to-end frontend/backend tests | `NONE` | Cover registration, login, recovery, and main business flows |
| CI pipeline | `NONE` | Run lint, tests, migration checks, and secret scanning |
| API schema/OpenAPI | `NONE` | Publish machine-readable request and response contracts |
| Health/readiness endpoints | `NONE` | Add separate liveness and dependency readiness checks |
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
2. Add role middleware and protect every write endpoint.
3. Add product and brand migrations with constraints and RLS.
4. Fix inventory report route ordering and make stock updates atomic.
5. Add authentication, authorization, and RLS integration tests.
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
