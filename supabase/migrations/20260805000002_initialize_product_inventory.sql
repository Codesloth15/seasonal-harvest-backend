-- Every catalog product must have exactly one current inventory balance.
-- Packaged products are tracked in pieces until product-specific base-unit
-- configuration is added; directly measured units retain their base unit.
CREATE OR REPLACE FUNCTION public.create_inventory_for_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base_unit public.inventory_unit_type;
BEGIN
  v_base_unit := CASE upper(btrim(COALESCE(NEW.unit, '')))
    WHEN 'KILOGRAM' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'KG' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'GRAM' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'G' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'LITER' THEN 'LITER'::public.inventory_unit_type
    WHEN 'LITRE' THEN 'LITER'::public.inventory_unit_type
    WHEN 'L' THEN 'LITER'::public.inventory_unit_type
    WHEN 'MILLILITER' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'MILLILITRE' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'ML' THEN 'MILLILITER'::public.inventory_unit_type
    ELSE 'PIECE'::public.inventory_unit_type
  END;

  INSERT INTO public.inventory (product_id, base_unit)
  VALUES (NEW.id, v_base_unit)
  ON CONFLICT (product_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_product_inventory_trigger ON public.products;
CREATE TRIGGER create_product_inventory_trigger
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.create_inventory_for_product();

-- Populate inventory for products that existed before the trigger was added.
INSERT INTO public.inventory (product_id, base_unit)
SELECT
  product.id,
  CASE upper(btrim(COALESCE(product.unit, '')))
    WHEN 'KILOGRAM' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'KG' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'GRAM' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'G' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'LITER' THEN 'LITER'::public.inventory_unit_type
    WHEN 'LITRE' THEN 'LITER'::public.inventory_unit_type
    WHEN 'L' THEN 'LITER'::public.inventory_unit_type
    WHEN 'MILLILITER' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'MILLILITRE' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'ML' THEN 'MILLILITER'::public.inventory_unit_type
    ELSE 'PIECE'::public.inventory_unit_type
  END
FROM public.products AS product
ON CONFLICT (product_id) DO NOTHING;
