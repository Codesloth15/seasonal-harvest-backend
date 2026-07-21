-- Create enum type for product categories
CREATE TYPE product_category AS ENUM ('Wet', 'Dry');

-- Create inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category product_category NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock_qty INTEGER DEFAULT 0 CHECK (stock_qty >= 0),
  low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for performance
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_stock ON inventory(stock_qty);
CREATE INDEX idx_inventory_created_by ON inventory(created_by);
CREATE INDEX idx_inventory_deleted_at ON inventory(deleted_at);
CREATE INDEX idx_inventory_category_stock ON inventory(category, stock_qty);

-- Enable Row Level Security (RLS)
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all non-deleted inventory" ON inventory
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can create inventory" ON inventory
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own inventory" ON inventory
  FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own inventory" ON inventory
  FOR DELETE USING (auth.uid() = created_by);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_inventory_updated_at_trigger
BEFORE UPDATE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_inventory_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory TO authenticated;
