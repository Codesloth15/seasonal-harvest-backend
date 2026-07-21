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

## Database Schema Reference

### Inventory Table
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Product name |
| category | product_category | NOT NULL | 'Wet' or 'Dry' |
| price | DECIMAL(10,2) | NOT NULL, >= 0 | Unit price |
| stock_qty | INTEGER | >= 0 | Current stock level |
| low_stock_threshold | INTEGER | >= 0 | Alert threshold |
| description | TEXT | Optional | Product details |
| created_by | UUID | FK to auth.users | Creator reference |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP | DEFAULT NULL | Soft delete timestamp |

## Environment Setup

Ensure your Supabase credentials are in `.env.development.local`:
```
SUPABASE_URL=https://xxqeiwzfvexuyftmtssy.supabase.co
SUPABASE_ANON_KEY=sb_publishable_R_9QK9QN9th-SJgfQ22SHg_2e7JWAqK
SUPABASE_PASSWORD=your-database-password
```

## First Time Setup

1. **Link your Supabase project** (if not already done):
   ```bash
   supabase link --project-ref xxqeiwzfvexuyftmtssy
   ```

2. **Push migrations to remote**:
   ```bash
   supabase db push
   ```

3. **Verify the table was created**:
   - Go to https://app.supabase.com
   - Navigate to SQL Editor
   - Run: `SELECT * FROM information_schema.tables WHERE table_name = 'inventory';`

## Troubleshooting

If you encounter RLS policy errors:
1. Ensure the user is authenticated
2. Check that `created_by` matches the authenticated user's UUID
3. Verify RLS policies are enabled on the table

For more information, see the main project [docs/info.md](../../docs/info.md)
