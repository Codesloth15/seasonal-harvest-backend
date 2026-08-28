# API Endpoint Reference

## Overview

This document lists the endpoints currently mounted by `app.js` for the Seasonal Harvest backend.

Local base URL:

```text
http://localhost:<PORT>/api/v1
```

Production base URL:

```text
https://<railway-domain>/api/v1
```

Replace `<PORT>` with the configured local port and `<railway-domain>` with the deployed Railway domain.

## Authentication

Protected endpoints require a Supabase access token:

```http
Authorization: Bearer <access-token>
```

Requests with a missing, invalid, or expired token return `401`.

## Response format

Typical success response:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

Typical error response:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Endpoint summary

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/` | Public | Basic server response |
| `POST` | `/api/v1/auth/sign-up` | Public | Create an account |
| `POST` | `/api/v1/auth/sign-in` | Public | Sign in with email and password |
| `POST` | `/api/v1/auth/forgot-password` | Public | Request a password-recovery email |
| `POST` | `/api/v1/auth/reset-password` | Bearer token | Set a new password using a recovery session |
| `POST` | `/api/v1/auth/sign-out` | Bearer token | Revoke Supabase refresh sessions |
| `GET` | `/api/v1/auth/me` | Bearer token | Return the authenticated user |
| `GET` | `/api/v1/inventory` | Bearer token | List product inventory balances |
| `GET` | `/api/v1/inventory/reports/summary` | Public route | Return inventory totals |
| `GET` | `/api/v1/inventory/reports/low-stock` | Public route | Return low-stock items |
| `GET` | `/api/v1/inventory/:id` | Public | Get an inventory item |
| `POST` | `/api/v1/assistant/chat` | Admin bearer token | Ask the read-only AI assistant about live products and inventory |
| `GET` | `/api/v1/analytics/dashboard` | Admin bearer token | Return catalog, inventory, and stock-movement dashboard metrics |
| `GET` | `/api/v1/analytics/transactions` | Admin bearer token | Browse the complete paginated inventory transaction log |
| `PUT` | `/api/v1/inventory/:id/packaging` | Bearer token | Configure base/package conversion |
| `POST` | `/api/v1/inventory/:id/adjust` | Bearer token | Atomically add or subtract stock and record a transaction |
| `GET` | `/api/v1/inventory/:id/transactions` | Bearer token | Return paginated ADD/SUBTRACT history |
| `GET` | `/api/v1/products` | Public | List products |
| `GET` | `/api/v1/products/:id` | Public | Get a product |
| `POST` | `/api/v1/products` | Admin or super admin | Create a product |
| `PUT` | `/api/v1/products/:id` | Admin or super admin | Update a product |
| `DELETE` | `/api/v1/products/:id` | Admin or super admin | Disable a product |
| `GET` | `/api/v1/brands` | Public | List brands |
| `GET` | `/api/v1/brands/:id` | Public | Get a brand |
| `POST` | `/api/v1/brands` | Admin or super admin | Create a brand |
| `PUT` | `/api/v1/brands/:id` | Admin or super admin | Update a brand |
| `DELETE` | `/api/v1/brands/:id` | Admin or super admin | Permanently delete a brand |
| `GET` | `/api/v1/categories` | Public | List categories |
| `GET` | `/api/v1/categories/:id` | Public | Get a category |
| `POST` | `/api/v1/categories` | Admin or super admin | Create a category |
| `PUT` | `/api/v1/categories/:id` | Admin or super admin | Update a category |
| `DELETE` | `/api/v1/categories/:id` | Admin or super admin | Delete a category |

Product and brand mutations require authentication and an active admin or super-admin profile.

## Analytics endpoints

### Dashboard analytics

```http
GET /api/v1/analytics/dashboard?from=2026-08-01&to=2026-08-31&granularity=day
Authorization: Bearer <admin-access-token>
```

This endpoint requires an active `admin` or `super_admin` profile. `from` and
`to` are optional inclusive UTC calendar dates in `YYYY-MM-DD` format. The
default range is the latest 30 calendar days, and the maximum range is 366
days. `granularity` accepts `day`, `week`, or `month`; weeks start on Monday.

The response contains:

- Catalog totals for active, inactive, branded, and unbranded products.
- Inventory quantities, reservations, low/out-of-stock counts, and retail
  value in PHP. Retail value is current stock multiplied by catalog price; it
  is not revenue, purchase cost, or realized profit.
- ADD/SUBTRACT totals, net stock change, transaction count, and chart-ready
  time-series buckets from the immutable inventory ledger.

Sales, revenue, order trends, and best-seller metrics are intentionally absent
until the order module and immutable order-item snapshots are implemented.

### Dashboard transaction log

```http
GET /api/v1/analytics/transactions?from=2026-08-01&to=2026-08-31&operation=ADD&transactionType=STOCK_RECEIVED&page=1&limit=20
Authorization: Bearer <admin-access-token>
```

This admin/super-admin endpoint returns all inventory ledger entries across all
products through pagination. `from`, `to`, `operation`, and `transactionType`
are optional. `operation` accepts `ADD` or `SUBTRACT`; `page` defaults to 1 and
`limit` defaults to 20 with a maximum of 100. When both dates are supplied, the
range cannot exceed 366 days. Omit the filters and advance through every page
to browse the complete transaction history.

Each row includes product identity, operation and transaction type, requested
quantity/unit, package conversion, signed base-unit change, previous/new
balances, reason, actor UUID, references, and creation time. The response has
the standard `data` array plus `pagination` metadata.

## Category endpoints

### List categories

```http
GET /api/v1/categories?search=wet&sort=name&order=asc
```

Optional parameters are `search`, `sort` (`name`, `created_at`, or `updated_at`), and `order` (`asc` or `desc`).

### Get category

```http
GET /api/v1/categories/:id
```

### Create category

```http
POST /api/v1/categories
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

```json
{
  "name": "Wet Goods",
  "description": "Fresh and refrigerated products",
  "icon": "snowflake"
}
```

### Update category

```http
PUT /api/v1/categories/:id
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

At least one of `name`, `description`, or `icon` is required.

### Delete category

```http
DELETE /api/v1/categories/:id
Authorization: Bearer <admin-access-token>
```

Category mutations require an active `admin` or `super_admin` profile and are also protected by Supabase RLS.

## Authentication endpoints

### Sign up

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

Request body:

```json
{
  "fullName": "Maria Santos",
  "email": "maria@example.com",
  "password": "secure-password"
}
```

Rules:

- `fullName` must contain 2–100 characters.
- `name` is accepted as an alias for `fullName`.
- `email` must be valid and is normalized to lowercase.
- `password` must contain at least 8 characters.
- Depending on Supabase configuration, the user may need to verify their email before signing in.

Success status: `201 Created`.

### Sign in

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

Request body:

```json
{
  "email": "maria@example.com",
  "password": "secure-password"
}
```

The Supabase access token is returned in:

```text
data.session.access_token
```

Invalid credentials return a generic `401` response that does not reveal whether the email exists.

### Forgot password

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

Request body:

```json
{
  "email": "maria@example.com"
}
```

The endpoint always returns a neutral success message when the request is accepted. This prevents account enumeration. Supabase sends the recovery email and redirects the user to `<FRONTEND_URL>/reset-password`.

### Reset password

```http
POST /api/v1/auth/reset-password
Authorization: Bearer <recovery-access-token>
Content-Type: application/json
```

Request body:

```json
{
  "password": "new-secure-password"
}
```

The password must contain at least 8 characters.

### Current user

```http
GET /api/v1/auth/me
Authorization: Bearer <access-token>
```

Returns the Supabase user associated with the verified access token.

### Sign out

```http
POST /api/v1/auth/sign-out
Authorization: Bearer <access-token>
```

Requests a global Supabase sign-out. The frontend must also remove its locally stored access and refresh tokens.

## Inventory endpoints

### List inventory

```http
GET /api/v1/inventory
Authorization: Bearer <access-token>
```

Optional query parameters:

| Parameter | Example | Description |
|---|---|---|
| `sort` | `created_at` | Supported inventory column used for sorting |
| `order` | `asc` or `desc` | Sort direction; defaults to `desc` |

Each inventory row includes related product fields (`id`, `name`, `sku`, `unit`,
`price`, `image_url`, `is_active`, `product_type`, and `brand_id`). Branded
products also contain `product.brand` with `id`, `name`, `logo_url`, and
`is_active`; unbranded products return `product.brand` as `null`. The image
remains owned by the product and is not duplicated in inventory. Stock is held
in `base_unit`; optional `package_unit` and `units_per_package` fields describe
receiving conversion.

### Inventory summary

```http
GET /api/v1/inventory/reports/summary
```

Intended response data:

```json
{
  "totalValue": "1000.00",
  "lowStockCount": 2,
  "totalItems": 10,
  "totalQuantity": 75,
  "averagePrice": "100.00"
}
```

This static route is registered before `/:id`, so Express resolves it correctly.

### Low-stock inventory

```http
GET /api/v1/inventory/reports/low-stock
```

Returns items whose generated `available_quantity` is less than or equal to
`low_stock_threshold`.

### Get inventory item

```http
GET /api/v1/inventory/:id
```

Path parameters:

| Parameter | Description |
|---|---|
| `id` | Inventory UUID |

### Configure inventory packaging

```http
PUT /api/v1/inventory/:id/packaging
Authorization: Bearer <access-token>
Content-Type: application/json
```

For a product priced at PHP 210 per piece and received as 15-piece bales:

```json
{
  "base_unit": "PIECE",
  "package_unit": "BALE",
  "units_per_package": 15
}
```

`base_unit` is used for product price, stock balance, valuation, and low-stock
calculations. `package_unit` is an accepted adjustment input unit.

### Adjust inventory stock

```http
POST /api/v1/inventory/:id/adjust
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

Request body:

```json
{
  "operation": "ADD",
  "quantity": 1,
  "unit": "BALE",
  "transaction_type": "STOCK_RECEIVED",
  "reason": "Received one 15-piece bale"
}
```

`quantity` must always be positive. `operation` determines its sign. The backend
uses the authenticated user's UUID for `performed_by`, prevents available stock
from becoming negative, and writes an immutable transaction in the same database
operation. With the configuration above, `1 BALE` produces a base-unit
`quantity_change` of `15 PIECE`. If `unit` is omitted, the base unit is used.
Inventory rows are created automatically when products are created.

### Inventory transaction history

```http
GET /api/v1/inventory/:id/transactions?operation=ADD&page=1&limit=20
Authorization: Bearer <access-token>
```

`operation` is optional and accepts `ADD` or `SUBTRACT`. `page` defaults to 1;
`limit` defaults to 20 and cannot exceed 100. Each row includes the requested
package quantity/unit, conversion factor, signed base-unit change, previous/new
balances, reason, actor, timestamp, and related product.

## Product endpoints

## Real-time change stream

```http
GET /api/v1/events/stream
Authorization: Bearer <access-token>
Accept: text/event-stream
```

This authenticated Server-Sent Events stream emits `data-change` events after
successful product and inventory mutations. Event data contains `resource`,
`action`, `id`, and `timestamp`; clients should refetch the affected resource.
Send the most recently received SSE ID as `Last-Event-ID` when reconnecting to
replay recent events retained by the running server process.

Because the browser's native `EventSource` API cannot attach an Authorization
header, authenticated frontends should consume this endpoint with a streaming
`fetch` client. The stream sends a heartbeat every 25 seconds.

### List products

```http
GET /api/v1/products
```

Optional query parameters:

| Parameter | Description |
|---|---|
| `categoryId` | Filter by category UUID |
| `brandId` | Filter by brand UUID |
| `productType` | Filter by `BRANDED` or `UNBRANDED` |
| `search` | Case-insensitive name search |
| `active` | Must be `true` or `false` |
| `sort` | `name`, `price`, `created_at`, or `updated_at` |
| `order` | `asc` or `desc` |

### Get product

```http
GET /api/v1/products/:id
```

### Create product

```http
POST /api/v1/products
Authorization: Bearer <supabase-access-token>
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Type | Notes |
|---|---|---|
| `category_id` | Text | Required category UUID |
| `brand_id` | Text | Required for `BRANDED`; omit for `UNBRANDED` |
| `name` | Text | Required |
| `description` | Text | Optional |
| `product_type` | Text | Required: `BRANDED` or `UNBRANDED` |
| `barcode` | Text | Optional |
| `unit` | Text | Optional |
| `price` | Text/number | Required non-negative PHP amount |
| `package_unit` | Text | Optional package unit such as `BALE` |
| `units_per_package` | Text/number | Required with `package_unit`; must be greater than 1 |
| `is_active` | Text/boolean | Optional; defaults to active |
| `image` | File | Optional JPEG, PNG, WebP, or AVIF; maximum 5 MB |

Required fields: `category_id`, `name`, `product_type`, and `price`. A `BRANDED` product also requires `brand_id`. The backend generates the SKU and reports prices in PHP. `price` is the price of one `unit`. For a 15-piece bale priced at PHP 12.50 per piece, send `unit: "PIECE"`, `price: 12.50`, `package_unit: "BALE"`, and `units_per_package: 15`. Packaging is returned on product responses and synchronized with inventory.

Product list, detail, create, and update responses include a nested `brand`
object with `id`, `name`, `logo_url`, and `is_active`. Unbranded products return
`brand` as `null`.

Security: this endpoint requires an active admin or super-admin profile.

When `image` is supplied, the backend stores it at
`product-images/{product-id}/{generated-filename}` and writes the resulting
public URL to `products.image_url`. Do not send Base64 image data in a JSON
`image_url` value: it can exceed the 100 KB JSON body limit and return
`413 Payload Too Large`. Browser clients should pass a `FormData` body and
must not manually set the multipart `Content-Type` boundary.

### Update product

```http
PUT /api/v1/products/:id
Content-Type: application/json
```

Accepts the supported product fields shown in the creation example. At least one valid field is required.

Security: this endpoint requires an active admin or super-admin profile.

### Delete product

```http
DELETE /api/v1/products/:id
```

This operation permanently removes the product row. It requires an authenticated admin or super admin.

Security: this endpoint requires an active admin or super-admin profile.

## Brand endpoints

### List brands

```http
GET /api/v1/brands
```

Optional query parameters:

| Parameter | Description |
|---|---|
| `search` | Case-insensitive brand-name search |
| `active` | Must be `true` or `false` |
| `sort` | `name`, `created_at`, or `updated_at` |
| `order` | `asc` or `desc` |

### Get brand

```http
GET /api/v1/brands/:id
```

### Create brand

```http
POST /api/v1/brands
Content-Type: application/json
```

Request body:

```json
{
  "name": "Sample Brand",
  "logo_url": "https://example.com/logo.png",
  "is_active": true
}
```

`name` is required.

Security: this endpoint requires an active admin or super-admin profile.

### Update brand

```http
PUT /api/v1/brands/:id
Content-Type: application/json
```

Accepted fields: `name`, `logo_url`, and `is_active`. At least one valid field is required.

Security: this endpoint requires an active admin or super-admin profile.

### Delete brand

```http
DELETE /api/v1/brands/:id
```

This operation permanently deletes the brand. If products reference the brand, the first request
returns `409 BRAND_DELETE_CONFIRMATION_REQUIRED` with `data.productCount`; clients should show a
confirmation dialog using the returned message. Repeat the request with `?confirm=true` to delete
the products and brand together. A brand without products is deleted immediately.

Security: this endpoint requires an active admin or super-admin profile.

## Production readiness blockers

- Add pagination and strict query validation to collection endpoints.
- Add integration tests that verify Express authorization and Supabase RLS together.
- Make SKU allocation collision-safe under concurrent product creation.
- Verify pending migrations, product-image storage, dashboard analytics, and
  role-protected requests against the target Supabase environment.
- Add security headers, route-specific authentication throttling, secret
  scanning, structured logging, and operational monitoring.
