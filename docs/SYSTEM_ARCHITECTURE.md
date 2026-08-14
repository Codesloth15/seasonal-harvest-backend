# Seasonal Harvest Backend: System Architecture and File Structure

## 1. System overview

Seasonal Harvest Backend is an ES-module Node.js API built with Express. Its mounted API manages authentication, inventory, products, brands, categories, dashboard analytics, and a read-only AI assistant. Supabase provides authentication, PostgreSQL storage, row-level security (RLS), and database migrations. Arcjet protects every `/api/v1` request with shield, bot-detection, and token-bucket rate-limit rules.

## 2. High-level architecture

```text
Client application
      |
      | HTTP/JSON
      v
Express app (`app.js`)
      |
      +-- JSON/multipart request parsing and CORS
      +-- Arcjet security middleware
      |
      v
Route module (`routes/`)
      |
      +-- Optional JWT authorization middleware
      |
      v
Controller (`controller/`)
      |
      | Validation, request mapping, response formatting
      v
Service/use case (`services/`)
      |
      | Business orchestration and not-found rules
      v
Model/data-access module (`model/`)
      |
      +-- Domain validation and query construction
      +-- SKU service when creating products
      |
      v
Supabase client (`config/supabase.js`)
      |
      v
Supabase PostgreSQL + Auth + RLS
```

Errors passed to `next(error)` flow to the shared error middleware, which returns a JSON response in the form:

```json
{
  "success": false,
  "error": "Error message"
}
```

## 3. Request lifecycle

1. `app.js` receives the request and parses JSON bodies. The product-create route uses Multer for its optional multipart image.
2. CORS permits the configured local frontend origins and credentialed requests.
3. Arcjet evaluates shield, bot, and rate-limit rules.
4. Express dispatches the request to a mounted route.
5. Protected operations pass through Supabase bearer-token authorization, which adds `req.user` and `req.accessToken`; role-protected routes also load the active application profile.
6. A controller maps HTTP input and calls a service use case.
7. The service applies orchestration rules and delegates persistence to a model/repository.
8. The model validates persistence input and uses the Supabase client to query PostgreSQL.
9. The controller returns the standard success payload, or forwards an error to `error.middleware.js`.

## 4. Active runtime components

### Application entry point

`app.js` constructs the testable Express application. `server.js` verifies Supabase connectivity, listens on `PORT`, and handles termination signals.

Currently mounted route groups:

| Base path | Router | Purpose |
|---|---|---|
| `/api/v1/inventory` | `routes/inventory.routes.js` | Balances, package configuration, atomic adjustments, transaction history, and reports |
| `/api/v1/products` | `routes/product.routes.js` | Product catalog CRUD |
| `/api/v1/brands` | `routes/brand.route.js` | Brand CRUD |
| `/api/v1/categories` | `routes/category.routes.js` | Category CRUD |
| `/api/v1/auth` | `routes/auth.routes.js` | Supabase authentication and recovery |
| `/api/v1/assistant` | `routes/assistant.routes.js` | Admin-only read-only AI assistant |
| `/api/v1/analytics` | `routes/analytics.routes.js` | Admin-only dashboard metrics and paginated global transaction logs |

### Routing layer

Route modules define HTTP methods and paths, attach route-specific middleware, and delegate work to controllers. They should remain thin and contain no database logic.

### Controller layer

Controllers read `req.params`, `req.query`, and `req.body`; perform request-level validation; call the appropriate model function; and shape HTTP responses. Errors are forwarded with `next(error)`.

### Model/data-access layer

Despite the directory name, the active Supabase model files act as repositories or data-access modules rather than ORM entity definitions:

- `inventory.model.js` queries balances and transactions, configures packaging, adjusts stock through an RPC, and calculates reports.
- `product.model.js` queries `products`, validates product fields and PHP prices, and permanently deletes products through the admin-protected endpoint.
- `brand.model.js` queries `brands` and permanently deletes brands through the authenticated Supabase client.
- `category.model.js` queries `categories` and uses a user-scoped Supabase client for protected writes.
- `analytics.model.js` loads role-authorized product, inventory, and ledger data within validated UTC date bounds.

### Service layer

Service modules apply use-case validation and orchestration. In particular,
`analytics.service.js` validates custom date ranges, pagination, ledger filters,
and daily/weekly/monthly granularity, then produces catalog KPIs, inventory
KPIs, chart-ready stock movement buckets, and a complete paginated activity
feed. `sku.service.js` generates product SKUs from brand and product
names, followed by a three-digit sequence based on existing matching SKUs.

### Configuration and infrastructure

- `config/env.js` loads `.env.<NODE_ENV>.local` and exports environment variables.
- `config/cors.js` validates the environment-defined browser-origin allowlist.
- `config/supabase.js` creates the shared Supabase client.
- `database/supabase.js` performs a startup connectivity check.
- `config/arcjet.js` declares global security rules.
- `supabase/migrations/` contains versioned PostgreSQL schema, RLS, trigger, and audit changes.

## 5. Repository file structure

```text
seasonal-harvest-backend/
|-- app.js                         # Testable Express composition root
|-- server.js                      # Process startup and graceful shutdown
|-- package.json                   # Runtime dependencies and npm scripts
|-- package-lock.json              # Locked dependency graph
|-- eslint.config.mjs              # ESLint configuration
|-- .env.development.local         # Local development secrets (not documentation)
|-- .env.production.local          # Production secrets (not documentation)
|
|-- config/
|   |-- env.js                     # Environment-file loading and exported settings
|   |-- cors.js                    # Validated CORS origin allowlist and policy
|   |-- supabase.js                # Shared Supabase client
|   `-- arcjet.js                  # Shield, bot detection, and rate limiting
|
|-- database/
|   `-- supabase.js                # Supabase startup connection check
|
|-- routes/
|   |-- inventory.routes.js        # Mounted inventory endpoints
|   |-- product.routes.js          # Mounted product endpoints
|   |-- brand.route.js             # Mounted brand endpoints
|   |-- category.routes.js         # Mounted category endpoints
|   |-- auth.routes.js             # Mounted Supabase Auth endpoints
|   |-- assistant.routes.js        # Admin-only AI assistant
|   `-- analytics.routes.js        # Admin-only dashboard analytics
|
|-- controller/
|   |-- inventory.controller.js    # Inventory HTTP handlers
|   |-- product.controller.js      # Product HTTP handlers
|   |-- brand.controller.js        # Brand HTTP handlers
|   |-- category.controller.js     # Category HTTP handlers
|   |-- auth.controller.js         # Supabase authentication handlers
|   |-- assistant.controller.js    # AI request validation and responses
|   `-- analytics.controller.js    # Dashboard analytics HTTP handler
|
|-- model/
|   |-- inventory.model.js         # Supabase inventory data access
|   |-- product.model.js           # Supabase product data access
|   |-- brand.model.js             # Supabase brand data access
|   |-- category.model.js          # Supabase category data access
|   `-- analytics.model.js         # Role-authorized dashboard source queries
|
|-- middleware/
|   |-- arcjet.middleware.js       # Global Arcjet request enforcement
|   |-- auth.middleware.js         # Bearer JWT verification
|   |-- role.middleware.js         # Active-profile and role authorization
|   `-- error.middleware.js        # Central JSON error handler
|
|-- services/
|   |-- auth.service.js            # Supabase Auth integration
|   |-- category.service.js        # Category use cases
|   |-- brand.service.js           # Brand use cases
|   |-- product.service.js         # Product use cases
|   |-- inventory.service.js       # Inventory use cases and validation
|   |-- assistant.service.js       # OpenAI tool-call loop
|   |-- analytics.service.js       # Dashboard filters and aggregation
|   `-- sku.service.js             # Product SKU generation
|
|-- supabase/
|   |-- config.toml                # Supabase CLI/local project configuration
|   `-- migrations/
|       |-- README.md              # Migration usage and inventory schema notes
|       |-- 20260424000001_create_inventory_table.sql
|       |-- 20260424000002_create_auth_and_roles.sql
|       |-- 20260728000001_create_categories_table.sql
|       |-- 20260728000002_create_brands_table.sql
|       |-- 20260728000003_create_products_table.sql
|       |-- 20260728000004_fix_profile_signup_trigger.sql
|       |-- 20260728000005_fix_profiles_rls_recursion.sql
|       |-- 20260729000001_create_product_image_storage_policies.sql
|       |-- 20260804000001_delete_brand_with_products.sql
|       |-- 20260805000001_create_inventory_adjustments.sql
|       |-- 20260805000002_initialize_product_inventory.sql
|       |-- 20260805000003_set_default_low_stock_threshold.sql
|       |-- 20260805000004_preserve_inventory_packaging_units.sql
|       `-- 20260805000005_add_inventory_package_conversion.sql
|
|-- docs/
|   |-- INVENTORY_SETUP.md         # Inventory schema and setup guide
|   |-- PRODUCT_MODULE.md          # Product module documentation
|   |-- BRAND_MODULE.md            # Brand module documentation
|   |-- AUTH.md                    # Authentication features and integration guide
|   |-- API_ENDPOINTS.md           # Central reference for active HTTP endpoints
|   |-- CATEGORY_MODULE.md         # Category schema, CRUD, and security guide
|   |-- SUPABASE_CRUD_SETUP.md     # Unified Supabase CRUD, RLS, and grants guide
|   |-- BUGS.md                    # Defects, incidents, and technical risks
|   |-- PROGRESS.md                # Feature completion and security roadmap
|   |-- TESTING.md                 # Unit testing, coverage, and security guidance
|   |-- AI_TOOLS_AND_DEPENDENCIES.md # AI integration and roadmap
|   |-- MOBILE_APP_API_INTEGRATION.md # Mobile endpoint and dashboard integration
|   `-- SYSTEM_ARCHITECTURE.md     # This document
|
|-- utils/
|   |-- http-error.js              # Typed HTTP application errors
|   |-- port.js                    # Strict environment port validation
|   `-- validation.js              # Shared request-value parsing
```

`node_modules/` and `.git/` are intentionally omitted from the tree.

## 6. Data architecture

### Inventory

The normalized `inventory` table stores one balance per product in its priced
`base_unit`. Optional `package_unit` and `units_per_package` fields support inputs
such as `1 BALE = 15 PIECE`. The immutable `inventory_transactions` ledger keeps
the requested unit/quantity, conversion factor, signed base-unit change,
before/after balances, reason, actor, and timestamp. Atomic RPC adjustment,
low-stock thresholds, timestamps, indexes, constraints, and RLS are committed.

### Products and brands

The committed migrations define `products` and `brands` with constraints, relationships, indexes, timestamps, active-record reads, and admin-only RLS for writes. Their API behavior is documented in `docs/PRODUCT_MODULE.md` and `docs/BRAND_MODULE.md`.

### Identity and authorization

The migrations extend Supabase Auth with `profiles`, role values (`employee`, `admin`, and `super_admin`), and RLS policies. Protected routes verify Supabase access tokens, and user-scoped Supabase clients forward authenticated identity to PostgREST so `auth.uid()` and RLS can evaluate the caller.

## 7. API conventions

Successful handlers generally return:

```json
{
  "success": true,
  "data": {}
}
```

Collection endpoints may also include `count`; mutations may include `message`. Product prices are exposed with the fixed currency `PHP`.

Inventory writes require `Authorization: Bearer <token>`. Category, product, and brand writes additionally require an active admin or super-admin profile, and their database RLS policies enforce the same authorization.

Dashboard analytics require an active admin or super-admin profile. The
analytics repository uses the caller-scoped Supabase client so PostgreSQL RLS
remains part of authorization. Inventory retail value is a current-price stock
estimate and is not sales revenue, purchase cost, or profit.

## 8. Important implementation notes

- Environment files contain secrets and must remain excluded from source control and documentation. Document variable names only, never their values.

## 9. Environment variables

The active application requires at least:

| Variable | Purpose |
|---|---|
| `PORT` | Express listening port |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous client key |
| `ARCJET_KEY` | Arcjet SDK key |
| `CORS_ORIGINS` | Comma-separated trusted browser origins |
| `FRONTEND_URL` | Password-recovery frontend destination |
| `OPENAI_API_KEY` | Server-only key required for AI assistant requests |
| `OPENAI_MODEL` | Optional AI model override |

## 10. Development commands

```bash
npm install
npm run dev
```

Production-style startup:

```bash
npm start
```

Apply committed Supabase migrations with:

```bash
supabase db push
```

## 11. Recommended direction

Continue using Supabase as the single identity and persistence architecture.
The next backend priorities are collision-safe SKU generation, integration
tests that verify Express authorization and Supabase RLS together, and
extending dashboard analytics with replenishment and category/brand metrics.
Sales, revenue, and best-seller analytics should follow the order schema and
immutable order-item snapshots rather than being inferred from stock movement.
