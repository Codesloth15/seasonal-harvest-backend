-- Preserve the superseded product-like inventory table created by the original
-- prototype. Product catalog data now lives in public.products.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'stock_qty'
  ) THEN
    ALTER TABLE public.inventory RENAME TO legacy_inventory;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.inventory_unit_type AS ENUM (
    'BOX', 'PACK', 'BALE', 'PIECE', 'SACK', 'CRATE', 'TRAY', 'BUNDLE',
    'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.inventory_transaction_type AS ENUM (
    'STOCK_RECEIVED', 'ORDER_RESERVED', 'ORDER_RELEASED', 'ORDER_COMPLETED',
    'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'DAMAGED', 'EXPIRED', 'MISSING',
    'MANUAL_ADJUSTMENT', 'INITIAL_STOCK'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reserved_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity NUMERIC GENERATED ALWAYS AS (quantity_on_hand - reserved_quantity) STORED,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  reorder_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0),
  base_unit public.inventory_unit_type NOT NULL DEFAULT 'PIECE',
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_reserved_not_above_on_hand CHECK (reserved_quantity <= quantity_on_hand)
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('ADD', 'SUBTRACT')),
  transaction_type public.inventory_transaction_type NOT NULL,
  quantity_change NUMERIC NOT NULL CHECK (quantity_change <> 0),
  previous_quantity NUMERIC NOT NULL CHECK (previous_quantity >= 0),
  new_quantity NUMERIC NOT NULL CHECK (new_quantity >= 0),
  reference_type TEXT,
  reference_id UUID,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_transaction_operation_sign CHECK (
    (operation = 'ADD' AND quantity_change > 0)
    OR (operation = 'SUBTRACT' AND quantity_change < 0)
  )
);

CREATE INDEX IF NOT EXISTS inventory_available_idx ON public.inventory (available_quantity);
CREATE INDEX IF NOT EXISTS inventory_transactions_inventory_created_idx
  ON public.inventory_transactions (inventory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_transactions_product_created_idx
  ON public.inventory_transactions (product_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_normalized_inventory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalized_inventory_updated_at_trigger ON public.inventory;
CREATE TRIGGER normalized_inventory_updated_at_trigger
BEFORE UPDATE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.update_normalized_inventory_updated_at();

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_inventory_id UUID,
  p_operation TEXT,
  p_quantity NUMERIC,
  p_transaction_type TEXT,
  p_reason TEXT,
  p_performed_by UUID
)
RETURNS TABLE (previous_quantity NUMERIC, quantity_change NUMERIC, new_quantity NUMERIC)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
  v_change NUMERIC;
  v_expected_operation TEXT;
BEGIN
  IF p_operation NOT IN ('ADD', 'SUBTRACT') THEN
    RAISE EXCEPTION 'Operation must be ADD or SUBTRACT.' USING ERRCODE = '22023';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be a positive number.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Reason is required and must not exceed 1000 characters.' USING ERRCODE = '22023';
  END IF;

  v_expected_operation := CASE p_transaction_type
    WHEN 'STOCK_RECEIVED' THEN 'ADD' WHEN 'CUSTOMER_RETURN' THEN 'ADD'
    WHEN 'INITIAL_STOCK' THEN 'ADD' WHEN 'ORDER_RELEASED' THEN 'ADD'
    WHEN 'DAMAGED' THEN 'SUBTRACT' WHEN 'EXPIRED' THEN 'SUBTRACT'
    WHEN 'MISSING' THEN 'SUBTRACT' WHEN 'SUPPLIER_RETURN' THEN 'SUBTRACT'
    WHEN 'ORDER_COMPLETED' THEN 'SUBTRACT' WHEN 'MANUAL_ADJUSTMENT' THEN p_operation
    ELSE NULL
  END;
  IF v_expected_operation IS NULL THEN
    RAISE EXCEPTION 'Transaction type is not supported for inventory adjustments.' USING ERRCODE = '22023';
  END IF;
  IF v_expected_operation <> p_operation THEN
    RAISE EXCEPTION '% adjustments must use %.', p_transaction_type, v_expected_operation USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inventory FROM public.inventory
  WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found.' USING ERRCODE = 'P0002';
  END IF;

  v_change := CASE WHEN p_operation = 'ADD' THEN p_quantity ELSE -p_quantity END;
  IF p_operation = 'SUBTRACT' AND p_quantity > v_inventory.available_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for this adjustment.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.inventory
  SET quantity_on_hand = quantity_on_hand + v_change
  WHERE id = p_inventory_id;

  INSERT INTO public.inventory_transactions (
    inventory_id, product_id, operation, transaction_type, quantity_change,
    previous_quantity, new_quantity, reason, performed_by
  ) VALUES (
    v_inventory.id, v_inventory.product_id, p_operation,
    p_transaction_type::public.inventory_transaction_type, v_change,
    v_inventory.quantity_on_hand, v_inventory.quantity_on_hand + v_change,
    btrim(p_reason), p_performed_by
  );

  RETURN QUERY SELECT v_inventory.quantity_on_hand, v_change,
    v_inventory.quantity_on_hand + v_change;
END;
$$;

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory" ON public.inventory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update inventory" ON public.inventory
  FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY "Authenticated users can read inventory transactions" ON public.inventory_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create inventory transactions" ON public.inventory_transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin());

GRANT SELECT ON public.inventory, public.inventory_transactions TO authenticated;
GRANT UPDATE ON public.inventory TO authenticated;
GRANT INSERT ON public.inventory_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID)
  TO authenticated;
