-- Track stock in the product's priced base unit while accepting package units.
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS package_unit public.inventory_unit_type,
  ADD COLUMN IF NOT EXISTS units_per_package NUMERIC NOT NULL DEFAULT 1;

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_package_conversion_valid;
ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_package_conversion_valid CHECK (
    (package_unit IS NULL AND units_per_package = 1)
    OR
    (package_unit IS NOT NULL AND package_unit <> base_unit AND units_per_package > 1)
  );

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS requested_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS requested_unit public.inventory_unit_type,
  ADD COLUMN IF NOT EXISTS base_units_per_requested_unit NUMERIC;

UPDATE public.inventory_transactions AS transaction
SET
  requested_quantity = abs(transaction.quantity_change),
  requested_unit = inventory.base_unit,
  base_units_per_requested_unit = 1
FROM public.inventory AS inventory
WHERE transaction.inventory_id = inventory.id
  AND transaction.requested_quantity IS NULL;

ALTER TABLE public.inventory_transactions
  ALTER COLUMN requested_quantity SET NOT NULL,
  ALTER COLUMN requested_unit SET NOT NULL,
  ALTER COLUMN base_units_per_requested_unit SET NOT NULL;

DROP FUNCTION IF EXISTS public.adjust_inventory_stock(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(
  p_inventory_id UUID,
  p_operation TEXT,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_transaction_type TEXT,
  p_reason TEXT,
  p_performed_by UUID
)
RETURNS TABLE (
  previous_quantity NUMERIC,
  requested_quantity NUMERIC,
  requested_unit public.inventory_unit_type,
  base_units_per_requested_unit NUMERIC,
  quantity_change NUMERIC,
  new_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_inventory public.inventory%ROWTYPE;
  v_requested_unit public.inventory_unit_type;
  v_conversion NUMERIC;
  v_base_quantity NUMERIC;
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
  IF v_expected_operation IS NULL OR v_expected_operation <> p_operation THEN
    RAISE EXCEPTION 'Transaction type does not support this operation.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inventory
  FROM public.inventory
  WHERE id = p_inventory_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found.' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    v_requested_unit := upper(btrim(COALESCE(p_unit, v_inventory.base_unit::TEXT)))::public.inventory_unit_type;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Adjustment unit is not supported.' USING ERRCODE = '22023';
  END;

  IF v_requested_unit = v_inventory.base_unit THEN
    v_conversion := 1;
  ELSIF v_requested_unit = v_inventory.package_unit THEN
    v_conversion := v_inventory.units_per_package;
  ELSE
    RAISE EXCEPTION 'Adjustment unit does not match the inventory base or package unit.' USING ERRCODE = '22023';
  END IF;

  v_base_quantity := p_quantity * v_conversion;
  v_change := CASE WHEN p_operation = 'ADD' THEN v_base_quantity ELSE -v_base_quantity END;
  IF p_operation = 'SUBTRACT' AND v_base_quantity > v_inventory.available_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for this adjustment.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.inventory
  SET quantity_on_hand = quantity_on_hand + v_change,
      last_received_at = CASE WHEN p_transaction_type = 'STOCK_RECEIVED' THEN NOW() ELSE last_received_at END
  WHERE id = p_inventory_id;

  INSERT INTO public.inventory_transactions (
    inventory_id, product_id, operation, transaction_type, quantity_change,
    previous_quantity, new_quantity, requested_quantity, requested_unit,
    base_units_per_requested_unit, reason, performed_by
  ) VALUES (
    v_inventory.id, v_inventory.product_id, p_operation,
    p_transaction_type::public.inventory_transaction_type, v_change,
    v_inventory.quantity_on_hand, v_inventory.quantity_on_hand + v_change,
    p_quantity, v_requested_unit, v_conversion, btrim(p_reason), p_performed_by
  );

  RETURN QUERY SELECT
    v_inventory.quantity_on_hand, p_quantity, v_requested_unit, v_conversion,
    v_change, v_inventory.quantity_on_hand + v_change;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID)
  TO authenticated;
