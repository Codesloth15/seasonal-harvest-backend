# Seasonal Harvest Backend: System Architecture and File Structure

## 1. System overview

Seasonal Harvest Backend is an ES-module Node.js API built with Express. Its currently mounted API manages inventory, products, and brands. Supabase provides the active data-access client, PostgreSQL storage, authentication tables, row-level security (RLS), and database migrations. Arcjet protects every incoming request with shield, bot-detection, and token-bucket rate-limit rules.

The repository also contains an older or incomplete MongoDB/Upstash subsystem for users, authentication, subscriptions, and reminder workflows. Those routes are not mounted by `app.js` and their required packages and MongoDB connection are not present in the current application setup.

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
6. A controller validates and maps HTTP input, then calls a model function.
7. The model performs domain checks and uses the Supabase client to query PostgreSQL.
8. The controller returns the standard success payload, or forwards an error to `error.middleware.js`.

## 4. Active runtime components

### Application entry point

`app.js` creates the Express server, installs global middleware, mounts the active routers, tests the Supabase connection, and listens on `PORT`.

Currently mounted route groups:

| Base path | Router | Purpose |
|---|---|---|
| `/api/v1/inventory` | `routes/inventory.routes.js` | Inventory CRUD, stock adjustment, and reports |
| `/api/v1/products` | `routes/product.routes.js` | Product catalog CRUD |
| `/api/v1/brands` | `routes/brand.route.js` | Brand CRUD |

### Routing layer

Route modules define HTTP methods and paths, attach route-specific middleware, and delegate work to controllers. They should remain thin and contain no database logic.

### Controller layer

Controllers read `req.params`, `req.query`, and `req.body`; perform request-level validation; call the appropriate model function; and shape HTTP responses. Errors are forwarded with `next(error)`.

### Model/data-access layer

Despite the directory name, the active Supabase model files act as repositories or data-access modules rather than ORM entity definitions:

- `inventory.model.js` queries `inventory`, implements soft deletion, adjusts stock, and calculates reports.
- `product.model.js` queries `products`, validates product fields and PHP prices, and soft-deletes by setting `is_active` to `false`.
- `brand.model.js` queries `brands` and soft-deletes by setting `is_active` to `false`.

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
|-- app.js                         # Express composition root and server startup
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
|   |-- arcjet.js                  # Shield, bot detection, and rate limiting
|   `-- upstah.js                  # Upstash Workflow client (currently inactive)
|
|-- database/
|   `-- supabase.js                # Supabase startup connection check
|
|-- routes/
|   |-- inventory.routes.js        # Mounted inventory endpoints
|   |-- product.routes.js          # Mounted product endpoints
|   |-- brand.route.js             # Mounted brand endpoints
|   |-- auth.routes.js             # Unmounted MongoDB auth endpoints
|   |-- user.routes.js             # Unmounted MongoDB user endpoints
|   |-- subscription.routes.js     # Unmounted subscription endpoints
|   `-- workflow.routes.js         # Unmounted reminder workflow endpoint
|
|-- controller/
|   |-- inventory.controller.js    # Inventory HTTP handlers
|   |-- product.controller.js      # Product HTTP handlers
|   |-- brand.controller.js        # Brand HTTP handlers
|   |-- auth.controller.js         # Legacy/incomplete MongoDB auth handlers
|   |-- user.controller.js         # Legacy/incomplete MongoDB user handlers
|   |-- subscription.controller.js # Legacy/incomplete subscription handlers
|   `-- workflow.controller.js     # Legacy/incomplete reminder workflow
|
|-- model/
|   |-- inventory.model.js         # Supabase inventory data access
|   |-- product.model.js           # Supabase product data access
|   |-- brand.model.js             # Supabase brand data access
|   |-- user.model.js              # Unwired Mongoose user schema
|   `-- subscription.model.js      # Unwired Mongoose subscription schema
|
|-- middleware/
|   |-- arcjet.middleware.js       # Global Arcjet request enforcement
|   |-- auth.middleware.js         # Bearer JWT verification
|   `-- error.middleware.js        # Central JSON error handler
|
|-- services/
|   `-- sku.service.js             # Product SKU generation
|
|-- supabase/
|   |-- config.toml                # Supabase CLI/local project configuration
|   `-- migrations/
|       |-- README.md              # Migration usage and inventory schema notes
|       |-- 20260424000001_create_inventory_table.sql
|       `-- 20260424000002_create_auth_and_roles.sql
|
|-- docs/
|   |-- INVENTORY_SETUP.md         # Inventory schema and setup guide
|   |-- PRODUCT_MODULE.md          # Product module documentation
|   |-- BRAND_MODULE.md            # Brand module documentation
|   |-- AUTH.md                    # Authentication features and integration guide
|   |-- PROGRESS.md                # Feature completion and security roadmap
|   |-- TESTING.md                 # Unit testing, coverage, and security guidance
|   `-- SYSTEM_ARCHITECTURE.md     # This document
|
`-- utils/                         # Reserved; currently empty
```

`node_modules/` and `.git/` are intentionally omitted from the tree.

## 6. Data architecture

### Inventory

The committed migrations define the `inventory` table with UUID identifiers, wet/dry categories, price and stock constraints, soft deletion through `deleted_at`, ownership through `created_by`, automatic timestamps, RLS policies, and audit logging.

### Products and brands

The application expects `products` and `brands` tables and documents them in `docs/PRODUCT_MODULE.md` and `docs/BRAND_MODULE.md`. Their creation migrations are not currently committed in `supabase/migrations/`.

### Identity and authorization

The migrations extend Supabase Auth with `profiles`, role values (`employee`, `admin`, and `super_admin`), and RLS policies. At the HTTP layer, protected inventory routes currently verify a locally signed JWT using `JWT_SECRET`; the Supabase client is initialized with the anonymous key. These mechanisms must use compatible user IDs and authentication context for ownership-based RLS policies to succeed.

## 7. API conventions

Successful handlers generally return:

```json
{
  "success": true,
  "data": {}
}
```

Collection endpoints may also include `count`; mutations may include `message`. Product prices are exposed with the fixed currency `PHP`.

Inventory writes require `Authorization: Bearer <token>`. Product and brand writes are currently public at the Express routing layer, though database RLS may still restrict them depending on the deployed schema.

## 8. Important implementation notes

- In `inventory.routes.js`, `/:id` is declared before `/reports/summary` and `/reports/low-stock`. Express will therefore treat `reports` as an ID for those requests. Static report routes should be declared before `/:id`.
- Authentication, user, subscription, and workflow routers exist but are not mounted in `app.js`.
- The MongoDB/Upstash files import packages such as `mongoose`, `bcryptjs`, `@upstash/workflow`, and `dayjs` that are not listed in the current `package.json`.
- No MongoDB connection is configured in the current startup path, so the Mongoose subsystem is not operational as committed.
- The shared error middleware still contains Mongoose-specific error translation even though the active data path uses Supabase.
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

Variables for the currently inactive workflow and legacy subsystem include `JWT_EXPIRES_IN`, `QSTASH_URL`, `QSTASH_TOKEN`, `SERVER_URL`, and `DB_URI`.

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

The repository should converge on one identity and persistence architecture. The current active path points toward Supabase, so the simplest direction is to use Supabase Auth tokens end-to-end, add committed migrations for products and brands, and either migrate the subscription subsystem to Supabase or explicitly restore and configure MongoDB and Upstash as separate infrastructure. Keeping active and legacy components clearly separated will make startup, deployment, authorization, and maintenance more predictable.
