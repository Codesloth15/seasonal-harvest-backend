# Inventory Management System Architecture

## System Overview
A scalable inventory management system built with Node.js/Express backend, Supabase (PostgreSQL) database, and RESTful API for managing products, stock levels, and inventory reports.

## Supabase Setup

### 1. Environment Variables
Add the following to your `.env.development.local`:

```
SUPABASE_PASSWORD=Seasonalinventorydb
SUPABASE_URL=https://xxqeiwzfvexuyftmtssy.supabase.co
SUPABASE_ANON_KEY=sb_publishable_R_9QK9QN9th-SJgfQ22SHg_2e7JWAqK

```

### 2. Database Schema

#### Create Inventory Table
Run this SQL in Supabase SQL Editor:

```sql
-- Create enum type for categories
CREATE TYPE product_category AS ENUM ('Wet', 'Dry');

-- Create inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category product_category NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock_qty INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL
);

-- Create indexes for performance
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_stock ON inventory(stock_qty);
CREATE INDEX idx_inventory_created_by ON inventory(created_by);
CREATE INDEX idx_inventory_deleted_at ON inventory(deleted_at);

-- Enable Row Level Security (RLS)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all inventory" ON inventory
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can create inventory" ON inventory
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own inventory" ON inventory
  FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own inventory" ON inventory
  FOR DELETE USING (auth.uid() = created_by);
```

#### Create Auto-Update Trigger for `updated_at`
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

## Database Schema

### Inventory Table Fields
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary Key | Unique identifier |
| name | VARCHAR(100) | NOT NULL | Product name |
| category | Enum | 'Wet', 'Dry' | Product type |
| price | DECIMAL(10,2) | NOT NULL | Unit price |
| stock_qty | INTEGER | default: 0 | Current stock |
| low_stock_threshold | INTEGER | default: 10 | Alert threshold |
| description | TEXT | Optional | Product details |
| created_by | UUID | FK to auth.users | Creator reference |
| created_at | TIMESTAMP | default: NOW() | Creation date |
| updated_at | TIMESTAMP | default: NOW() | Last update |
| deleted_at | TIMESTAMP | default: NULL | Soft delete |

## API Endpoints

### Products Management
```
GET    /api/v1/inventory              - Get all products (supports ?category=Wet&sort=price)
GET    /api/v1/inventory/:id          - Get single product details
POST   /api/v1/inventory              - Create new product (requires auth)
PUT    /api/v1/inventory/:id          - Edit product details (requires auth)
DELETE /api/v1/inventory/:id          - Remove product (requires auth)
```

### Stock Management
```
PATCH  /api/v1/inventory/:id/stock    - Adjust stock (add/subtract units, requires auth)
GET    /api/v1/inventory/reports/summary     - Get inventory summary
GET    /api/v1/inventory/reports/low-stock   - Get all low stock items
```

## Core Features

### 1. Stock Management
- Atomic increment/decrement operations
- Validation to prevent negative stock
- Real-time low stock alerts
- Stock movement tracking

### 2. Low Stock Alerts
- Configurable thresholds per product
- Real-time low stock notifications
- Dashboard highlighting
- Report generation

### 3. Inventory Reports
- Total inventory value calculation
- Low stock item reports
- Stock analysis by category
- Audit trail with soft deletes

### 4. Product Categories
- Wet goods
- Dry goods
- Extensible enum structure

## Stock Update Logic
```javascript
// PATCH /api/v1/inventory/:id/stock
// Body: { adjustment: 10 } or { adjustment: -5 }
// Uses PostgreSQL atomic operations
```

## Authentication & Authorization
- JWT-based authentication via Supabase Auth
- Row-Level Security (RLS) policies
- Only authorized users can create/edit inventory
- Creator tracking for audit purposes
- Automatic user association

## Implementation Stack
- **Backend**: Node.js + Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + JWT
- **Error Handling**: Centralized middleware
- **Validation**: Schema-level validation + API validation

## Best Practices
1. **Soft Deletes**: Use `deleted_at` field for historical tracking
2. **Atomic Operations**: Use PostgreSQL transactions for stock changes
3. **Audit Trail**: Timestamps track all changes automatically
4. **Security**: Row-Level Security (RLS) controls data access
5. **Performance**: Strategic indexes on frequently queried columns
6. **Scalability**: Supabase auto-scales with your needs

## Installing Dependencies
```bash
npm install @supabase/supabase-js
```

## Migration from MongoDB
The refactoring from MongoDB to Supabase provides:
- Better data integrity with PostgreSQL relational constraints
- Real-time capabilities with Supabase
- Built-in authentication integration
- Row-Level Security for data privacy
- Automatic backups and disaster recovery
