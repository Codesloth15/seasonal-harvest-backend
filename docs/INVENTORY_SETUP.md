# Inventory Management and Frontend API Guide

## Overview

Inventory stores one current stock balance per catalog product. Product names,
SKUs, units, prices, images, product types, and brand relationships remain in
`products`; inventory responses include them through the `product` relationship.

Creating a catalog product automatically creates its inventory row with:

- `quantity_on_hand`: `0`
- `reserved_quantity`: `0`
- `available_quantity`: `0`
- `low_stock_threshold`: `10`
- `base_unit`: derived from the product unit, then configurable for package conversion

The API base URL used below is:

```text
http://localhost:5500/api/v1
```

Replace it with the deployed backend URL in production. Protected endpoints
require the Supabase access token in `Authorization: Bearer <ACCESS_TOKEN>`.

## Features

- One inventory balance per product
- Automatic inventory creation when a product is created
- Packaging-aware units such as crates, boxes, bales, packs, and pieces
- Package conversion into the product's priced base unit
- Quantity on hand, reserved quantity, and generated available quantity
- Configurable low-stock threshold, defaulting to 10
- Inventory listing and single-item lookup
- Inventory summary and low-stock reports
- Atomic ADD and SUBTRACT adjustments
- Prevention of stock subtraction beyond available quantity
- Immutable transaction ledger for every adjustment
- Related product name, SKU, unit, price, status, image, product type, and nested brand details in read responses

## Inventory fields

| Field | Description |
|---|---|
| `id` | Inventory UUID used by inventory endpoints |
| `product_id` | Unique reference to `products.id` |
| `quantity_on_hand` | Total physical stock |
| `reserved_quantity` | Quantity reserved for pending orders |
| `available_quantity` | Generated as `quantity_on_hand - reserved_quantity` |
| `low_stock_threshold` | Low-stock boundary; defaults to 10 |
| `reorder_quantity` | Suggested replenishment quantity |
| `base_unit` | Unit represented by the inventory quantity |
| `package_unit` | Optional receiving package, such as `BALE` |
| `units_per_package` | Number of base units in one package |
| `last_received_at` | Most recent receiving timestamp |
| `created_at` | Inventory creation timestamp |
| `updated_at` | Most recent inventory update timestamp |
| `product` | Related product details returned by read endpoints |

An item is low stock when:

```text
available_quantity <= low_stock_threshold
```

Therefore, with the default threshold, quantities from 0 through 10 are low
stock. A quantity of 11 is not low stock.

## Supported inventory units

| Stored value | Accepted product-unit examples |
|---|---|
| `CRATE` | `CRATE`, `CRATES` |
| `BOX` | `BOX`, `BOXES` |
| `BALE` | `BALE`, `BALES` |
| `PACK` | `PACK`, `PACKS`, `PK` |
| `PIECE` | `PIECE`, `PIECES`, `PC`, `PCS` |
| `SACK` | `SACK`, `SACKS` |
| `TRAY` | `TRAY`, `TRAYS` |
| `BUNDLE` | `BUNDLE`, `BUNDLES` |
| `KILOGRAM` | `KILOGRAM`, `KILOGRAMS`, `KG`, `KGS` |
| `GRAM` | `GRAM`, `GRAMS`, `G` |
| `LITER` | `LITER`, `LITERS`, `LITRE`, `LITRES`, `L` |
| `MILLILITER` | `MILLILITER`, `MILLILITERS`, `MILLILITRE`, `MILLILITRES`, `ML` |

Without package conversion, inventory uses the normalized product unit. With
package conversion, inventory stores quantities in `base_unit` and accepts
`package_unit` adjustments. For example, one `BALE` containing 15 `PIECE` units
adds 15 to `quantity_on_hand`. Unknown or empty product units fall back to `PIECE`.

## Endpoint summary

| Method | Endpoint | Authentication | Status |
|---|---|---|---|
| `GET` | `/inventory` | Bearer token | Available |
| `GET` | `/inventory/:inventoryId` | Public route | Available |
| `GET` | `/inventory/reports/summary` | Public route | Available |
| `GET` | `/inventory/reports/low-stock` | Public route | Available |
| `PUT` | `/inventory/:inventoryId/packaging` | Bearer token | Available |
| `POST` | `/inventory/:inventoryId/adjust` | Bearer token | Available |
| `GET` | `/inventory/:inventoryId/transactions` | Bearer token | Available |
| `GET` | `/analytics/dashboard` | Admin or super-admin bearer token | Available; consolidated inventory KPIs and movement trends |
| `GET` | `/analytics/transactions` | Admin or super-admin bearer token | Available; paginated global transaction ledger |
| `POST` | `/inventory` | Bearer token | Legacy handler; do not use with normalized inventory |
| `PUT` | `/inventory/:inventoryId` | Bearer token | Legacy handler; do not use with normalized inventory |
| `DELETE` | `/inventory/:inventoryId` | Bearer token | Legacy handler; do not use with normalized inventory |

Create and edit product information through the product endpoints. Inventory is
created automatically and stock changes must use the adjustment endpoint.
Admin dashboards should use `/api/v1/analytics/dashboard` for consolidated
catalog totals, inventory KPIs, and date-filtered stock-movement chart data.
The endpoint supports `from`, `to`, and `granularity=day|week|month`.
Use `/api/v1/analytics/transactions` to show a dashboard activity table across
all products. It supports optional `from`, `to`, `operation`, and
`transactionType` filters plus `page` and `limit` pagination.

## Standard response shape

Successful reads return:

```json
{
  "success": true,
  "data": {}
}
```

Successful list endpoints return an array in `data`. Errors are passed through
the shared error middleware and include an appropriate HTTP status and message.

## List inventory

```http
GET /api/v1/inventory?sort=created_at&order=desc
Authorization: Bearer <ACCESS_TOKEN>
```

Supported query parameters:

| Parameter | Allowed values | Default |
|---|---|---|
| `sort` | `created_at`, `updated_at`, `quantity_on_hand`, `reserved_quantity`, `low_stock_threshold`, `last_received_at` | `created_at` |
| `order` | `asc`, `desc` | `desc` |

The controller currently accepts `category`, but the normalized repository does
not apply that filter. The frontend should not rely on it yet.

### curl

```bash
curl --request GET \
  --url "http://localhost:5500/api/v1/inventory?sort=quantity_on_hand&order=asc" \
  --header "Authorization: Bearer ACCESS_TOKEN"
```

### Example response

```json
{
  "success": true,
  "data": [
    {
      "id": "inventory-uuid",
      "product_id": "product-uuid",
      "quantity_on_hand": 20,
      "reserved_quantity": 0,
      "available_quantity": 20,
      "low_stock_threshold": 10,
      "reorder_quantity": 0,
      "base_unit": "BOX",
      "last_received_at": null,
      "created_at": "2026-08-05T06:00:00.000Z",
      "updated_at": "2026-08-05T06:00:00.000Z",
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
  ]
}
```

Use `product.image_url` for the image and `product.brand.name` for the displayed
brand name. Display a frontend placeholder when the image is `null`. For an
unbranded product, both `product.brand_id` and `product.brand` are `null`.

## Get one inventory item

The path parameter is the inventory UUID, not the product UUID.

```http
GET /api/v1/inventory/:inventoryId
```

### curl

```bash
curl --request GET \
  --url "http://localhost:5500/api/v1/inventory/INVENTORY_UUID"
```

A missing inventory item returns `404` with `Inventory item not found.`

## Inventory summary

```http
GET /api/v1/inventory/reports/summary
```

### curl

```bash
curl --request GET \
  --url "http://localhost:5500/api/v1/inventory/reports/summary"
```

### Example response

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

`totalValue` is the sum of product price multiplied by quantity on hand.

## Low-stock report

```http
GET /api/v1/inventory/reports/low-stock
```

Items are sorted from the lowest available quantity to the highest.

### curl

```bash
curl --request GET \
  --url "http://localhost:5500/api/v1/inventory/reports/low-stock"
```

### Example response

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "inventory-uuid",
      "product_id": "product-uuid",
      "quantity_on_hand": 10,
      "reserved_quantity": 0,
      "available_quantity": 10,
      "low_stock_threshold": 10,
      "base_unit": "CRATE",
      "product": {
        "id": "product-uuid",
        "name": "Sample Product",
        "sku": "SAMPLE-001",
        "unit": "CRATE",
        "price": 500,
        "image_url": null,
        "is_active": true
      }
    }
  ]
}
```

## Add stock

### Configure package conversion

Configure this once when a product is priced per piece but received in a larger
package. For chicken priced at PHP 210 per piece with 15 pieces per bale:

```bash
curl --request PUT \
  --url "http://localhost:5500/api/v1/inventory/INVENTORY_UUID/packaging" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "base_unit": "PIECE",
    "package_unit": "BALE",
    "units_per_package": 15
  }'
```

The product price remains PHP 210 per `PIECE`. Inventory quantities and stock
value are stored in pieces, while adjustments may be entered in pieces or bales.

The client sends a positive `quantity`; the operation determines its direction.
The backend gets `performed_by` from the verified access token.

```http
POST /api/v1/inventory/:inventoryId/adjust
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

### curl: receive one bale

```bash
curl --request POST \
  --url "http://localhost:5500/api/v1/inventory/INVENTORY_UUID/adjust" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "operation": "ADD",
    "quantity": 1,
    "unit": "BALE",
    "transaction_type": "STOCK_RECEIVED",
    "reason": "Received one bale containing 15 chicken pieces"
  }'
```

## Subtract stock

### curl: remove three damaged pieces

```bash
curl --request POST \
  --url "http://localhost:5500/api/v1/inventory/INVENTORY_UUID/adjust" \
  --header "Authorization: Bearer ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "operation": "SUBTRACT",
    "quantity": 3,
    "unit": "PIECE",
    "transaction_type": "DAMAGED",
    "reason": "Three chicken pieces were damaged"
  }'
```

### Successful adjustment response

```json
{
  "success": true,
  "message": "Inventory adjusted successfully.",
  "data": {
    "previous_quantity": 20,
    "requested_quantity": 3,
    "requested_unit": "PIECE",
    "base_units_per_requested_unit": 1,
    "quantity_change": -3,
    "new_quantity": 17
  }
}
```

`quantity_change` is positive for ADD and negative for SUBTRACT.

### Validation and errors

- `operation` must be `ADD` or `SUBTRACT`.
- `quantity` must be a positive JSON number, not a numeric string.
- `unit` must match the configured base unit or package unit. If omitted, the
  adjustment uses the base unit.
- `transaction_type` must support the requested operation.
- `reason` is required and cannot exceed 1,000 characters.
- SUBTRACT cannot exceed `available_quantity`.
- Excessive subtraction returns HTTP `400` with
  `Insufficient stock for this adjustment.`

## Transaction types

| Transaction type | Required operation | Typical use |
|---|---|---|
| `STOCK_RECEIVED` | `ADD` | Supplier delivery |
| `CUSTOMER_RETURN` | `ADD` | Sellable customer return |
| `INITIAL_STOCK` | `ADD` | Opening inventory count |
| `ORDER_RELEASED` | `ADD` | Return released reservation |
| `DAMAGED` | `SUBTRACT` | Damaged stock |
| `EXPIRED` | `SUBTRACT` | Expired stock |
| `MISSING` | `SUBTRACT` | Missing stock after a count |
| `SUPPLIER_RETURN` | `SUBTRACT` | Stock returned to supplier |
| `ORDER_COMPLETED` | `SUBTRACT` | Completed order deduction |
| `MANUAL_ADJUSTMENT` | `ADD` or `SUBTRACT` | Correct a verified count |

The PostgreSQL adjustment RPC locks the inventory row, checks available stock,
updates the balance, and inserts its ledger record in one atomic operation.

## Adjustment transaction logs

Every adjustment writes an immutable row to `inventory_transactions` containing:

- operation and transaction type
- signed quantity change
- previous and new quantities
- reason
- authenticated user in `performed_by`
- creation timestamp

```http
GET /api/v1/inventory/:inventoryId/transactions?operation=ADD&page=1&limit=20
Authorization: Bearer <ACCESS_TOKEN>
```

Query parameters:

| Parameter | Allowed values | Default |
|---|---|---|
| `operation` | `ADD`, `SUBTRACT`, or omitted for both | Both |
| `page` | Positive integer | `1` |
| `limit` | Integer from 1 through 100 | `20` |

### curl: fetch all ADD logs

```bash
curl --request GET \
  --url "http://localhost:5500/api/v1/inventory/INVENTORY_UUID/transactions?operation=ADD&page=1&limit=20" \
  --header "Authorization: Bearer ACCESS_TOKEN"
```

### Example response

```json
{
  "success": true,
  "data": [
    {
      "id": "transaction-uuid",
      "inventory_id": "inventory-uuid",
      "product_id": "product-uuid",
      "operation": "ADD",
      "transaction_type": "STOCK_RECEIVED",
      "requested_quantity": 1,
      "requested_unit": "BALE",
      "base_units_per_requested_unit": 15,
      "quantity_change": 15,
      "previous_quantity": 0,
      "new_quantity": 15,
      "reason": "Received one bale containing 15 chicken pieces",
      "performed_by": "user-uuid",
      "created_at": "2026-08-05T07:00:00.000Z",
      "product": {
        "id": "product-uuid",
        "name": "Sample Product",
        "sku": "SAMPLE-001",
        "unit": "PIECE",
        "image_url": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Authorized developers can also inspect the ledger directly in Supabase with:

```sql
SELECT
  transaction.id,
  transaction.inventory_id,
  product.name AS product_name,
  product.sku,
  transaction.operation,
  transaction.transaction_type,
  transaction.requested_quantity,
  transaction.requested_unit,
  transaction.base_units_per_requested_unit,
  transaction.quantity_change,
  transaction.previous_quantity,
  transaction.new_quantity,
  transaction.reason,
  transaction.performed_by,
  transaction.created_at
FROM public.inventory_transactions AS transaction
JOIN public.products AS product ON product.id = transaction.product_id
WHERE transaction.inventory_id = 'INVENTORY_UUID'
ORDER BY transaction.created_at DESC;
```

## Frontend fetch examples

```js
const API_URL = "http://localhost:5500/api/v1";

export async function listInventory(accessToken) {
  const response = await fetch(`${API_URL}/inventory?sort=created_at&order=desc`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to load inventory");
  return body.data;
}

export async function adjustInventory(inventoryId, adjustment, accessToken) {
  const response = await fetch(`${API_URL}/inventory/${inventoryId}/adjust`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(adjustment),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to adjust inventory");
  return body.data;
}

export async function configureInventoryPackaging(inventoryId, packaging, accessToken) {
  const response = await fetch(`${API_URL}/inventory/${inventoryId}/packaging`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(packaging),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to configure packaging");
  return body.data;
}

export async function getInventoryTransactions(inventoryId, accessToken, operation = "") {
  const params = new URLSearchParams({ page: "1", limit: "20" });
  if (operation) params.set("operation", operation);
  const response = await fetch(
    `${API_URL}/inventory/${inventoryId}/transactions?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to load transaction logs");
  return { transactions: body.data, pagination: body.pagination };
}
```

Example frontend call:

```js
await adjustInventory(
  inventoryId,
  {
    operation: "ADD",
    quantity: 10,
    unit: "PIECE",
    transaction_type: "STOCK_RECEIVED",
    reason: "Received ten crates",
  },
  accessToken,
);
```

After an adjustment, refresh the inventory list, low-stock report, and summary so
the UI reflects the new balance.

## Applying the migrations

Apply migrations in timestamp order:

```powershell
supabase db push
```

Normalized inventory migrations:

1. `20260805000001_create_inventory_adjustments.sql`
2. `20260805000002_initialize_product_inventory.sql`
3. `20260805000003_set_default_low_stock_threshold.sql`
4. `20260805000004_preserve_inventory_packaging_units.sql`
5. `20260805000005_add_inventory_package_conversion.sql`

Verify product and inventory units:

```sql
SELECT
  inventory.id,
  inventory.product_id,
  product.name,
  product.unit AS product_unit,
  inventory.base_unit,
  inventory.package_unit,
  inventory.units_per_package,
  inventory.quantity_on_hand,
  inventory.available_quantity,
  inventory.low_stock_threshold
FROM public.inventory AS inventory
JOIN public.products AS product ON product.id = inventory.product_id
ORDER BY product.name;
```

## Current limitations

- The registered inventory POST, PUT, and DELETE handlers still target the retired
  product-like inventory schema and should not be used by the frontend.
- The category query parameter is accepted but not applied by the repository.
- Receiving does not yet record supplier, cost, batch, expiration, or packaging
  conversion details.
- Public report and item routes currently rely on the database read policy. Review
  their authentication requirements before production deployment.
