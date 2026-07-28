# Seasonal Harvest Backend: System Architecture and File Structure

## 1. System overview

Seasonal Harvest Backend is an ES-module Node.js API built with Express. Its mounted API manages authentication, inventory, products, brands, and categories. Supabase provides authentication, PostgreSQL storage, row-level security (RLS), and database migrations. Arcjet protects every incoming request with shield, bot-detection, and token-bucket rate-limit rules.

## 2. High-level architecture

```text
Client application
      |
      | HTTP/JSON
      v
Express app (`app.js`)
      |
      +-- Request parsing, cookies, and CORS
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

1. `app.js` receives the request and parses JSON, URL-encoded data, and cookies.
2. CORS permits the configured local frontend origins and credentialed requests.
3. Arcjet evaluates shield, bot, and rate-limit rules.
4. Express dispatches the request to a mounted route.
5. Protected inventory mutations pass through JWT authorization, which adds `req.user`.
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
| `/api/v1/inventory` | `routes/inventory.routes.js` | Inventory CRUD, stock adjustment, and reports |
| `/api/v1/products` | `routes/product.routes.js` | Product catalog CRUD |
| `/api/v1/brands` | `routes/brand.route.js` | Brand CRUD |
| `/api/v1/categories` | `routes/category.routes.js` | Category CRUD |

### Routing layer

Route modules define HTTP methods and paths, attach route-specific middleware, and delegate work to controllers. They should remain thin and contain no database logic.

### Controller layer

Controllers read `req.params`, `req.query`, and `req.body`; perform request-level validation; call the appropriate model function; and shape HTTP responses. Errors are forwarded with `next(error)`.

### Model/data-access layer

Despite the directory name, the active Supabase model files act as repositories or data-access modules rather than ORM entity definitions:

- `inventory.model.js` queries `inventory`, implements soft deletion, adjusts stock, and calculates reports.
- `product.model.js` queries `products`, validates product fields and PHP prices, and soft-deletes by setting `is_active` to `false`.
- `brand.model.js` queries `brands` and soft-deletes by setting `is_active` to `false`.
- `category.model.js` queries `categories` and uses a user-scoped Supabase client for protected writes.

### Service layer

`services/sku.service.js` generates product SKUs from the brand and product names, followed by a three-digit sequence based on existing matching SKUs.

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
|   `-- auth.routes.js             # Mounted Supabase Auth endpoints
|
|-- controller/
|   |-- inventory.controller.js    # Inventory HTTP handlers
|   |-- product.controller.js      # Product HTTP handlers
|   |-- brand.controller.js        # Brand HTTP handlers
|   |-- category.controller.js     # Category HTTP handlers
|   `-- auth.controller.js         # Supabase authentication handlers
|
|-- model/
|   |-- inventory.model.js         # Supabase inventory data access
|   |-- product.model.js           # Supabase product data access
|   |-- brand.model.js             # Supabase brand data access
|   `-- category.model.js          # Supabase category data access
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
|       `-- 20260728000004_fix_profile_signup_trigger.sql
|
|-- docs/
|   |-- INVENTORY_SETUP.md         # Inventory schema and setup guide
|   |-- PRODUCT_MODULE.md          # Product module documentation
|   |-- BRAND_MODULE.md            # Brand module documentation
|   |-- AUTH.md                    # Authentication features and integration guide
|   |-- API_ENDPOINTS.md           # Central reference for active HTTP endpoints
|   |-- CATEGORY_MODULE.md         # Category schema, CRUD, and security guide
|   |-- SUPABASE_CRUD_SETUP.md     # Unified Supabase CRUD, RLS, and grants guide
|   |-- PROGRESS.md                # Feature completion and security roadmap
|   |-- TESTING.md                 # Unit testing, coverage, and security guidance
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

The committed migrations define the `inventory` table with UUID identifiers, wet/dry categories, price and stock constraints, soft deletion through `deleted_at`, ownership through `created_by`, automatic timestamps, RLS policies, and audit logging.

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

Continue using Supabase as the single identity and persistence architecture. The next priorities are making stock and SKU changes concurrency-safe and adding integration tests that verify Express authorization and Supabase RLS together.
