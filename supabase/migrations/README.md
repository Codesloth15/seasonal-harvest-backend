# Supabase Migrations

This directory contains all database migration files for the Supabase project.

## Running Migrations

### Push migrations to remote Supabase project:
```bash
supabase db push
```

### Create a new migration:
```bash
supabase migration new <migration_name>
```

### Reset local database:
```bash
supabase db reset
```

## Migration Files

### `20260424000001_create_inventory_table.sql`
Initial migration that creates:
- **Inventory Table**: Main table for product inventory management
  - Columns: id, name, category, price, stock_qty, low_stock_threshold, description, created_by, timestamps
  - Constraints: NOT NULL, CHECK constraints for prices and quantities
  - Soft deletes: using `deleted_at` column

- **Enum Type**: `product_category` with values 'Wet', 'Dry'

- **Indexes**: Performance indexes on frequently queried columns
  - category, stock_qty, created_by, deleted_at
  - Composite index on (category, stock_qty)

- **Row Level Security (RLS)**:
  - SELECT: Users can view all non-deleted items
  - INSERT: Users can only insert items they create
  - UPDATE: Users can only update their own items
  - DELETE: Users can only delete their own items

- **Automatic Timestamps**:
  - Trigger to auto-update `updated_at` on every modification

### `20260424000002_create_auth_and_roles.sql`

Creates Supabase profiles, employee/admin/super-admin roles, audit logs, profile RLS, and automatic profile creation for new Auth users.

### `20260728000001_create_categories_table.sql`

Creates categories, case-insensitive unique names, automatic timestamps, public reads, and active admin/super-admin write policies.

### `20260728000002_create_brands_table.sql`

Creates brands, active-only public reads, case-insensitive unique names, automatic timestamps, and admin-only write policies.

### `20260728000003_create_products_table.sql`

Creates products with category and brand relationships, branded/unbranded constraints, unique SKU and barcode indexes, active-only public reads, automatic timestamps, and admin-only write policies.

### `20260728000004_fix_profile_signup_trigger.sql`

Repairs profile creation with a restricted `SECURITY DEFINER` trigger function so Supabase Auth can insert the matching `profiles` row without signup being blocked by public-schema permissions or RLS.

### `20260728000005_fix_profiles_rls_recursion.sql`

Replaces recursive profile role policies with restricted `SECURITY DEFINER` role helpers and limits direct profile updates to `full_name`.

### `20260805000001_create_inventory_adjustments.sql`

Preserves the retired product-like inventory table as `legacy_inventory`, creates
the normalized product inventory balance and immutable transaction ledger, adds
inventory unit and transaction enums, enables RLS, and installs the atomic
`adjust_inventory_stock` RPC.

### `20260805000002_initialize_product_inventory.sql`

Backfills one zero-stock inventory row for every existing product and installs an
`AFTER INSERT` product trigger so future catalog products receive inventory
automatically.

### `20260805000003_set_default_low_stock_threshold.sql`

Sets the default low-stock threshold to 10 and updates inventory rows that still
use the previous zero threshold.

### `20260805000004_preserve_inventory_packaging_units.sql`

Maps singular, plural, and abbreviated product units to inventory units and
updates existing inventory so crates, boxes, bales, packs, and pieces remain distinct.

### `20260805000005_add_inventory_package_conversion.sql`

Separates the priced base unit from an optional receiving package unit, records
the conversion on adjustment transactions, and converts package adjustments to
base-unit stock atomically.

### `20260826000001_add_product_packaging.sql`

Adds `package_unit` and `units_per_package` to catalog products, backfills existing
inventory packaging, and keeps product and inventory packaging synchronized.

## Database Schema Reference

### Inventory Table (current normalized schema)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| product_id | UUID | UNIQUE, FK to products | Catalog product |
| quantity_on_hand | NUMERIC | >= 0 | Total physical stock |
| reserved_quantity | NUMERIC | >= 0 | Stock reserved for orders |
| available_quantity | NUMERIC | Generated | On hand minus reserved |
| low_stock_threshold | NUMERIC | >= 0, DEFAULT 10 | Low-stock boundary (available quantity <= 10 by default) |
| reorder_quantity | NUMERIC | >= 0 | Suggested reorder amount |
| base_unit | inventory_unit_type | NOT NULL | Smallest tracked unit |
| package_unit | inventory_unit_type | Optional | Receiving package such as `BALE` |
| units_per_package | NUMERIC | > 1 when packaged | Base units contained in one package |
| last_received_at | TIMESTAMPTZ | Optional | Most recent receipt |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

## Environment Setup

Ensure your Supabase credentials are in `.env.development.local`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_PASSWORD=your-database-password
```

## First Time Setup

1. **Link your Supabase project** (if not already done):
   ```bash
   supabase link --project-ref your-project-reference
   ```

2. **Push migrations to remote**:
   ```bash
   supabase db push
   ```

3. **Verify inventory was initialized**:
   - Go to https://app.supabase.com
   - Navigate to SQL Editor
   - Run: `SELECT id, product_id, quantity_on_hand FROM public.inventory;`

## Troubleshooting

If you encounter RLS policy errors:
1. Ensure the user is authenticated
2. Confirm the API forwards the authenticated caller's access token
3. Verify RLS policies are enabled on the table

For more information, see the [inventory setup guide](../../docs/INVENTORY_SETUP.md).
