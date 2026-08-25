# Seasonal Harvest Mobile App API Integration

This document explains how an iOS or Android application connects to the Seasonal Harvest backend, authenticates users, fetches data, and performs supported mutations.

## 1. API base URL

All application endpoints are mounted below:

```text
/api/v1
```

Suggested mobile environment configuration:

```env
# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1

# iOS simulator
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1

# Physical device (replace with the development computer's LAN address)
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api/v1

# Production
EXPO_PUBLIC_API_URL=https://your-api-domain.example/api/v1
```

An Android emulator cannot reach the development computer through `localhost`; use `10.0.2.2`. A physical device must use an address reachable from the same network.

The unversioned service checks are:

```http
GET /
GET /health
```

## 2. Backend configuration

Create `.env.development.local` locally. Never commit real credentials.

```env
NODE_ENV=development
PORT=3000

# Exact browser origins only. Do not add paths or use a wildcard.
CORS_ORIGINS=http://localhost:5173,http://localhost:8081

# Destination used by password-recovery email links.
FRONTEND_URL=http://localhost:5173

# Server-only settings.
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
ARCJET_KEY=your-arcjet-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=your-supported-openai-model

AI_RATE_LIMIT_MAX=10
AI_RATE_LIMIT_WINDOW_MS=60000
```

Start the API:

```powershell
npm install
npm run dev
```

Apply the committed database migrations before using the application:

```powershell
supabase db push
```

Native requests generally do not include a browser `Origin` header. Expo Web and other browser clients must use an exact origin listed in `CORS_ORIGINS`.

Do not expose `OPENAI_API_KEY`, `ARCJET_KEY`, a Supabase service-role key, or database credentials in a mobile bundle. The app normally needs only `EXPO_PUBLIC_API_URL`. It needs the public Supabase anon key only if it directly uses the Supabase client for token refresh or recovery links.

## 3. Request and response conventions

JSON requests use:

```http
Accept: application/json
Content-Type: application/json
```

Protected routes additionally require:

```http
Authorization: Bearer <supabase-access-token>
```

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

Common status codes:

| Status | Meaning | Recommended app behavior |
|---|---|---|
| `400` | Invalid input | Show the validation message |
| `401` | Missing, invalid, or expired token | End or refresh the session |
| `403` | Insufficient role or inactive profile | Show permission denied |
| `404` | Record not found | Show a not-found state |
| `409` | Conflict or confirmation required | Show the relevant confirmation flow |
| `429` | Rate limit reached | Ask the user to retry later |
| `500` | Server failure | Show an error state with Retry |

## 4. Authentication

The sign-in response contains tokens at:

```text
data.session.access_token
data.session.refresh_token
```

Store tokens in platform-secure storage, such as Expo SecureStore, iOS Keychain, or Android Keystore.

### Authentication endpoints

| Method | Endpoint | Authentication | Request body |
|---|---|---|---|
| `POST` | `/auth/sign-up` | Public | `fullName`, `email`, `password` |
| `POST` | `/auth/sign-in` | Public | `email`, `password` |
| `POST` | `/auth/forgot-password` | Public | `email` |
| `POST` | `/auth/reset-password` | Recovery bearer token | `password` |
| `GET` | `/auth/me` | Bearer token | None |
| `POST` | `/auth/sign-out` | Bearer token | None |

### Sign up

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "fullName": "Maria Santos",
  "email": "maria@example.com",
  "password": "password123"
}
```

Rules:

- Full name must contain 2–100 characters.
- `name` is accepted as an alias for `fullName`.
- Email must be valid.
- Password must contain at least eight characters.
- Depending on Supabase settings, email verification may be required.

### Sign in

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "maria@example.com",
  "password": "password123"
}
```

Example response:

```json
{
  "success": true,
  "message": "Signed in successfully.",
  "data": {
    "user": {},
    "session": {
      "access_token": "...",
      "refresh_token": "..."
    }
  }
}
```

### Forgot and reset password

Request an email:

```json
{
  "email": "maria@example.com"
}
```

The email redirects to `<FRONTEND_URL>/reset-password`. Native apps should configure an approved universal link or deep link before production.

Set the new password using the recovery token:

```http
POST /api/v1/auth/reset-password
Authorization: Bearer <recovery-access-token>
Content-Type: application/json
```

```json
{
  "password": "new-password123"
}
```

### Current user and sign out

```http
GET /api/v1/auth/me
Authorization: Bearer <access-token>
```

```http
POST /api/v1/auth/sign-out
Authorization: Bearer <access-token>
```

The app must remove locally stored tokens after sign-out.

The backend does not currently expose a refresh-token endpoint. Use the Supabase client SDK to refresh a session, or add a backend `/auth/refresh` endpoint before relying exclusively on this API for session lifecycle management.

## 5. Products

| Method | Endpoint | Authentication |
|---|---|---|
| `GET` | `/products` | Public |
| `GET` | `/products/:productId` | Public |
| `POST` | `/products` | Admin or Super Admin |
| `PUT` | `/products/:productId` | Admin or Super Admin |
| `DELETE` | `/products/:productId` | Admin or Super Admin |

### List and filter products

```http
GET /api/v1/products?search=chicken&categoryId=<uuid>&brandId=<uuid>&productType=BRANDED&active=true&sort=price&order=asc
```

Supported values:

| Parameter | Values |
|---|---|
| `productType` | `BRANDED`, `UNBRANDED` |
| `active` | `true`, `false` |
| `sort` | `name`, `price`, `created_at`, `updated_at` |
| `order` | `asc`, `desc` |

### Create a product

Branded product:

```json
{
  "name": "Tender Juicy Hotdog",
  "description": "Frozen hotdog product",
  "category_id": "category-uuid",
  "product_type": "BRANDED",
  "brand_id": "brand-uuid",
  "barcode": "480000000001",
  "unit": "BOX",
  "price": 185
}
```

Unbranded product:

```json
{
  "name": "Fresh Tomatoes",
  "description": "Fresh local tomatoes",
  "category_id": "category-uuid",
  "product_type": "UNBRANDED",
  "unit": "KILOGRAM",
  "price": 95
}
```

Rules:

- `name`, `category_id`, `product_type`, and `price` are required.
- Price must be a non-negative PHP amount.
- A `BRANDED` product requires `brand_id`.
- An `UNBRANDED` product must not include `brand_id`.
- SKU is generated by the backend.
- Returned products include `currency: "PHP"`.

To include an image, send `multipart/form-data`. The file field must be named `image`. JPEG, PNG, WebP, and AVIF are accepted, with a maximum size of 5 MB. Do not manually set the multipart boundary.

```js
const form = new FormData();
form.append("name", "Tender Juicy Hotdog");
form.append("category_id", categoryId);
form.append("product_type", "BRANDED");
form.append("brand_id", brandId);
form.append("unit", "BOX");
form.append("price", "185");
form.append("image", {
  uri: selectedImageUri,
  name: "product.jpg",
  type: "image/jpeg",
});
```

### Update or disable a product

```http
PUT /api/v1/products/:productId
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

```json
{
  "name": "Updated Product",
  "price": 195,
  "unit": "BOX",
  "is_active": true
}
```

Product image replacement is not supported by the current update route.

To disable a product without deleting it:

```json
{
  "is_active": false
}
```

`DELETE /products/:productId` permanently deletes the product in the current implementation.

## 6. Brands

| Method | Endpoint | Authentication |
|---|---|---|
| `GET` | `/brands` | Public |
| `GET` | `/brands/:brandId` | Public |
| `POST` | `/brands` | Admin or Super Admin |
| `PUT` | `/brands/:brandId` | Admin or Super Admin |
| `DELETE` | `/brands/:brandId` | Admin or Super Admin |

List and filter:

```http
GET /api/v1/brands?search=cdo&active=true&sort=name&order=asc
```

Supported sort columns are `name`, `created_at`, and `updated_at`.

Create or update:

```json
{
  "name": "CDO",
  "logo_url": "https://example.com/cdo.png",
  "is_active": true
}
```

If the brand has products, an initial delete returns `409` with code `BRAND_DELETE_CONFIRMATION_REQUIRED` and a product count. After explicit user confirmation, call:

```http
DELETE /api/v1/brands/:brandId?confirm=true
Authorization: Bearer <admin-access-token>
```

This confirmed operation can permanently delete both the brand and its associated products.

## 7. Categories

| Method | Endpoint | Authentication |
|---|---|---|
| `GET` | `/categories` | Public |
| `GET` | `/categories/:categoryId` | Public |
| `POST` | `/categories` | Admin or Super Admin |
| `PUT` | `/categories/:categoryId` | Admin or Super Admin |
| `DELETE` | `/categories/:categoryId` | Admin or Super Admin |

List and filter:

```http
GET /api/v1/categories?search=frozen&sort=name&order=asc
```

Supported sort columns are `name`, `created_at`, and `updated_at`.

Create:

```json
{
  "name": "Frozen Foods",
  "description": "Frozen meat and packaged products",
  "icon": "snowflake"
}
```

Update:

```json
{
  "description": "Updated category description",
  "icon": "package"
}
```

A category referenced by products may be protected from deletion by its database relationship.

## 8. Inventory

Inventory IDs and product IDs are different. Inventory detail, adjustment, packaging, and transaction routes require the inventory row's `id`.

### Supported mobile endpoints

| Method | Endpoint | Authentication |
|---|---|---|
| `GET` | `/inventory` | Any authenticated user |
| `GET` | `/inventory/reports/summary` | Public route |
| `GET` | `/inventory/reports/low-stock` | Public route |
| `GET` | `/inventory/:inventoryId` | Public route |
| `PUT` | `/inventory/:inventoryId/packaging` | Any authenticated user |
| `POST` | `/inventory/:inventoryId/adjust` | Any authenticated user |
| `GET` | `/inventory/:inventoryId/transactions` | Any authenticated user |

Do not use legacy `POST /inventory`, `PUT /inventory/:id`, or `DELETE /inventory/:id` handlers. They target a retired product-like inventory schema.

### List inventory

```http
GET /api/v1/inventory?sort=quantity_on_hand&order=asc
Authorization: Bearer <access-token>
```

Supported sorting:

```text
created_at
updated_at
quantity_on_hand
reserved_quantity
low_stock_threshold
last_received_at
```

The accepted `category` query parameter is not currently applied by the repository. Do not rely on it.

Example item:

```json
{
  "id": "inventory-uuid",
  "product_id": "product-uuid",
  "quantity_on_hand": 20,
  "reserved_quantity": 0,
  "available_quantity": 20,
  "low_stock_threshold": 10,
  "base_unit": "BOX",
  "package_unit": null,
  "units_per_package": null,
  "product": {
    "id": "product-uuid",
    "name": "Tender Juicy Hotdog",
    "sku": "CDO-HOTDOG-001",
    "unit": "BOX",
    "price": 185,
    "image_url": null,
    "is_active": true,
    "product_type": "BRANDED",
    "brand_id": "brand-uuid",
    "brand": {
      "id": "brand-uuid",
      "name": "CDO",
      "logo_url": null,
      "is_active": true
    }
  }
}
```

Use `product.image_url` for the displayed product image and `product.brand.name`
for the brand label. Provide an image placeholder when `image_url` is `null`.
Unbranded products return `product.brand_id: null` and `product.brand: null`.

### Inventory reports

```http
GET /api/v1/inventory/reports/summary
```

```json
{
  "success": true,
  "data": {
    "totalValue": "12500.00",
    "lowStockCount": 4,
    "totalItems": 12,
    "totalQuantity": 86,
    "averagePrice": "1041.67"
  }
}
```

```http
GET /api/v1/inventory/reports/low-stock
```

An item is low-stock when `available_quantity <= low_stock_threshold`.

### Configure packaging conversion

```http
PUT /api/v1/inventory/:inventoryId/packaging
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "base_unit": "PIECE",
  "package_unit": "BALE",
  "units_per_package": 15
}
```

Supported units:

```text
BOX, PACK, BALE, PIECE, SACK, CRATE, TRAY, BUNDLE,
KILOGRAM, GRAM, LITER, MILLILITER
```

The package unit must differ from the base unit, and `units_per_package` must be greater than 1.

### Adjust stock

Receive stock:

```http
POST /api/v1/inventory/:inventoryId/adjust
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "operation": "ADD",
  "quantity": 1,
  "unit": "BALE",
  "transaction_type": "STOCK_RECEIVED",
  "reason": "Received one bale from delivery"
}
```

Remove stock:

```json
{
  "operation": "SUBTRACT",
  "quantity": 3,
  "unit": "PIECE",
  "transaction_type": "DAMAGED",
  "reason": "Three damaged pieces removed"
}
```

`quantity` must be a positive JSON number, not a numeric string. The backend obtains `performed_by` from the authenticated user; the app must not send that field.

| Transaction type | Required operation |
|---|---|
| `STOCK_RECEIVED` | `ADD` |
| `CUSTOMER_RETURN` | `ADD` |
| `INITIAL_STOCK` | `ADD` |
| `ORDER_RELEASED` | `ADD` |
| `DAMAGED` | `SUBTRACT` |
| `EXPIRED` | `SUBTRACT` |
| `MISSING` | `SUBTRACT` |
| `SUPPLIER_RETURN` | `SUBTRACT` |
| `ORDER_COMPLETED` | `SUBTRACT` |
| `MANUAL_ADJUSTMENT` | Either |

The reason is required and cannot exceed 1,000 characters. Subtraction cannot exceed available stock.

After a successful adjustment, refresh the inventory list, summary, low-stock report, and relevant transaction history.

### Transaction history

```http
GET /api/v1/inventory/:inventoryId/transactions?operation=ADD&page=1&limit=20
Authorization: Bearer <access-token>
```

`operation` may be `ADD`, `SUBTRACT`, or omitted. `page` must be positive and `limit` must be between 1 and 100.

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## 9. AI assistant

The assistant is available only to active Admin and Super Admin profiles.

```http
POST /api/v1/assistant/chat
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

```json
{
  "message": "Which products are low in stock?"
}
```

The message is required and cannot exceed 2,000 characters. The default per-instance limit is 10 requests per authenticated user per 60 seconds. The assistant is read-only and cannot mutate catalog or inventory records.

## 10. Dashboard analytics

Dashboard analytics are available only to active Admin and Super Admin profiles.

```http
GET /api/v1/analytics/dashboard?from=2026-08-01&to=2026-08-31&granularity=day
Authorization: Bearer <admin-access-token>
```

`from` and `to` are optional inclusive UTC dates in `YYYY-MM-DD` format. The
default range is 30 days and the maximum is 366 days. `granularity` accepts
`day`, `week`, or `month`; weekly periods start on Monday.

The response groups data under `catalog`, `inventory`, and `movements`:

```json
{
  "success": true,
  "data": {
    "range": {
      "from": "2026-08-01",
      "to": "2026-08-31",
      "granularity": "day"
    },
    "catalog": {
      "totalProducts": 25,
      "activeProducts": 23,
      "inactiveProducts": 2,
      "brandedProducts": 18,
      "unbrandedProducts": 7
    },
    "inventory": {
      "inventoryItemCount": 23,
      "totalQuantityOnHand": 450,
      "totalReservedQuantity": 20,
      "totalAvailableQuantity": 430,
      "inventoryRetailValue": 72500,
      "lowStockCount": 4,
      "outOfStockCount": 1,
      "currency": "PHP"
    },
    "movements": {
      "transactionCount": 12,
      "totalAdditions": 120,
      "totalSubtractions": 35,
      "netChange": 85,
      "series": [
        {
          "period": "2026-08-01",
          "additions": 20,
          "subtractions": 5,
          "netChange": 15,
          "transactionCount": 2
        }
      ]
    }
  }
}
```

Use `movements.series` directly for a stock-movement chart. Empty dates are not
inserted by the backend, so a chart that requires a continuous axis should fill
missing periods with zeroes. `inventoryRetailValue` uses current product prices;
it must not be labelled revenue, purchase cost, or profit.

The backend does not yet provide sales, revenue, order, or best-seller metrics.

### Complete dashboard transaction log

Use the global analytics log for an admin activity table that can browse every
inventory movement across all products:

```http
GET /api/v1/analytics/transactions?from=2026-08-01&to=2026-08-31&operation=ADD&transactionType=STOCK_RECEIVED&page=1&limit=20
Authorization: Bearer <admin-access-token>
```

All filters are optional. `operation` accepts `ADD` or `SUBTRACT`; `limit` is
1–100. The response includes a `data` array and `pagination` with `page`,
`limit`, `total`, and `totalPages`. Load additional pages when the user scrolls
or selects the next page—do not request an unbounded ledger.

Each row contains the product, requested quantity/unit, conversion factor,
signed base-unit change, previous/new balances, reason, actor UUID, transaction
type, optional reference, and timestamp. Use `created_at` as the activity time
and preserve the signed `quantity_change` when displaying stock impact.

## 11. Reusable mobile API client

```js
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function apiFetch(
  path,
  { method = "GET", token, body, headers = {} } = {},
) {
  const isFormData = body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  let result;
  try {
    result = await response.json();
  } catch {
    result = {
      success: false,
      error: "The server returned an invalid response.",
    };
  }

  if (!response.ok) {
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    error.code = result.code;
    error.data = result.data;
    throw error;
  }

  return result;
}
```

Public read:

```js
const result = await apiFetch("/products?active=true&sort=name&order=asc");
const products = result.data;
```

Protected read:

```js
const result = await apiFetch("/inventory", { token: accessToken });
const inventory = result.data;
```

Admin dashboard read:

```js
const result = await apiFetch(
  "/analytics/dashboard?from=2026-08-01&to=2026-08-31&granularity=day",
  { token: accessToken },
);
const dashboard = result.data;
```

Paginated dashboard activity:

```js
const result = await apiFetch(
  "/analytics/transactions?page=1&limit=20",
  { token: accessToken },
);
const transactions = result.data;
const pagination = result.pagination;
```

Mutation:

```js
await apiFetch(`/inventory/${inventoryId}/adjust`, {
  method: "POST",
  token: accessToken,
  body: {
    operation: "ADD",
    quantity: 10,
    unit: "PIECE",
    transaction_type: "STOCK_RECEIVED",
    reason: "Received ten pieces",
  },
});
```

## 12. Suggested app-loading flow

After authentication, validate the session with `/auth/me`, then load independent dashboard resources concurrently:

```js
const [
  currentUser,
  inventory,
  summary,
  lowStock,
  products,
  categories,
  brands,
] = await Promise.all([
  apiFetch("/auth/me", { token: accessToken }),
  apiFetch("/inventory", { token: accessToken }),
  apiFetch("/inventory/reports/summary"),
  apiFetch("/inventory/reports/low-stock"),
  apiFetch("/products?active=true&sort=name&order=asc"),
  apiFetch("/categories?sort=name&order=asc"),
  apiFetch("/brands?active=true&sort=name&order=asc"),
]);
```

For an Admin or Super Admin analytics screen, request the consolidated
`/analytics/dashboard` resource instead of deriving KPIs from the inventory
list, and load `/analytics/transactions` for the paginated activity log.
Employees must not call these endpoints because the server returns `403`.

Role-restricted controls should be hidden for employees. The server remains the source of truth and will return `403` when a user does not have the required role.

## 13. Current integration limitations

- There is no backend refresh-token endpoint.
- Inventory category filtering is accepted by the controller but not applied by the repository.
- Legacy inventory create, update, and delete handlers should not be used.
- Product image upload is supported during creation, but image replacement is not supported on product update.
- Product deletion is permanent; use `is_active: false` when the intended behavior is disabling.
- Confirmed brand deletion may also permanently delete associated products.
- Public inventory report and detail routes should have their production access policy reviewed before launch.
- Dashboard analytics do not yet include category/brand performance, replenishment estimates, sales, revenue, orders, or best sellers.
