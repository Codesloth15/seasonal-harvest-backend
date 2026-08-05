# Inventory Management

## Overview

Inventory stores one current stock balance per catalog product. Product names,
SKUs, prices, and images remain in `products`; inventory responses include them
through the `product` relationship.

Creating a product automatically creates its inventory row with zero stock.
Migration `20260805000002_initialize_product_inventory.sql` also backfills rows
for products that existed before the trigger was installed.

## Current stock fields

| Column | Description |
|---|---|
| `id` | Inventory UUID used by inventory endpoints |
| `product_id` | Unique reference to `products.id` |
| `quantity_on_hand` | Total physical stock |
| `reserved_quantity` | Stock reserved for pending orders |
| `available_quantity` | Generated value: `quantity_on_hand - reserved_quantity` |
| `low_stock_threshold` | Available quantity that triggers low-stock status |
| `reorder_quantity` | Suggested replenishment quantity |
| `base_unit` | Smallest tracked unit, such as `PIECE`, `KILOGRAM`, or `LITER` |
| `last_received_at` | Most recent receiving timestamp |
| `created_at` / `updated_at` | Audit timestamps |

Packaged products are tracked in their smallest sellable unit. For example,
five boxes containing twelve pieces each add 60 `PIECE` units.

## Adjustment endpoint

```http
POST /api/v1/inventory/:inventoryId/adjust
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

Add stock:

```json
{
  "operation": "ADD",
  "quantity": 20,
  "transaction_type": "MANUAL_ADJUSTMENT",
  "reason": "Physical count found additional stock"
}
```

Subtract stock:

```json
{
  "operation": "SUBTRACT",
  "quantity": 3,
  "transaction_type": "DAMAGED",
  "reason": "Three packs were damaged"
}
```

The client always sends a positive quantity. The backend derives
`performed_by` from the verified access token and does not trust a client UUID.

The `adjust_inventory_stock` PostgreSQL RPC locks the inventory row, validates
available stock, updates the balance, and inserts an audit transaction in one
atomic operation. A subtraction that exceeds available stock returns `400` with
`Insufficient stock for this adjustment.`

## Transaction operation mapping

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
| `MANUAL_ADJUSTMENT` | `ADD` or `SUBTRACT` |

Every transaction records the operation, signed quantity change, previous and
new quantities, reason, authenticated actor, and creation time. Transaction
history is never edited or deleted through normal API operations.

## Reading inventory

```http
GET /api/v1/inventory
Authorization: Bearer <access-token>
```

The endpoint requires authentication because inventory RLS permits authenticated
reads. Each row includes related product data:

```json
{
  "id": "inventory-uuid",
  "product_id": "product-uuid",
  "quantity_on_hand": 20,
  "reserved_quantity": 0,
  "available_quantity": 20,
  "base_unit": "PIECE",
  "product": {
    "id": "product-uuid",
    "name": "Tender Juicy Hotdog",
    "sku": "CDO-HOTDOG-001",
    "price": 185,
    "image_url": "https://project.supabase.co/storage/v1/object/public/product-images/..."
  }
}
```

Images are not duplicated in inventory; use `product.image_url` and show a
frontend placeholder when it is null.

## Applying the migrations

Apply migrations in timestamp order:

```powershell
supabase db push
```

The normalized inventory migrations are:

1. `20260805000001_create_inventory_adjustments.sql`
2. `20260805000002_initialize_product_inventory.sql`

Verify the product-to-inventory relationship:

```sql
SELECT inventory.id, inventory.product_id, products.name,
       inventory.quantity_on_hand, inventory.available_quantity
FROM public.inventory
JOIN public.products ON products.id = inventory.product_id;
```

## Current scope

The operation-based adjustment flow is implemented. The complete receiving flow
with receipts, suppliers, packaging conversion, cost, batch, and expiration data
still requires the planned `POST /api/v1/inventory/receive` endpoint and atomic
receiving RPC.
