-- Every catalog product must have exactly one current inventory balance.
CREATE OR REPLACE FUNCTION public.normalize_inventory_unit(p_unit TEXT)
RETURNS public.inventory_unit_type
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE upper(btrim(COALESCE(p_unit, '')))
    WHEN 'BOX' THEN 'BOX'::public.inventory_unit_type
    WHEN 'BOXES' THEN 'BOX'::public.inventory_unit_type
    WHEN 'PACK' THEN 'PACK'::public.inventory_unit_type
    WHEN 'PACKS' THEN 'PACK'::public.inventory_unit_type
    WHEN 'PK' THEN 'PACK'::public.inventory_unit_type
    WHEN 'BALE' THEN 'BALE'::public.inventory_unit_type
    WHEN 'BALES' THEN 'BALE'::public.inventory_unit_type
    WHEN 'SACK' THEN 'SACK'::public.inventory_unit_type
    WHEN 'SACKS' THEN 'SACK'::public.inventory_unit_type
    WHEN 'CRATE' THEN 'CRATE'::public.inventory_unit_type
    WHEN 'CRATES' THEN 'CRATE'::public.inventory_unit_type
    WHEN 'TRAY' THEN 'TRAY'::public.inventory_unit_type
    WHEN 'TRAYS' THEN 'TRAY'::public.inventory_unit_type
    WHEN 'BUNDLE' THEN 'BUNDLE'::public.inventory_unit_type
    WHEN 'BUNDLES' THEN 'BUNDLE'::public.inventory_unit_type
    WHEN 'PIECE' THEN 'PIECE'::public.inventory_unit_type
    WHEN 'PIECES' THEN 'PIECE'::public.inventory_unit_type
    WHEN 'PC' THEN 'PIECE'::public.inventory_unit_type
    WHEN 'PCS' THEN 'PIECE'::public.inventory_unit_type
    WHEN 'KILOGRAM' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'KILOGRAMS' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'KG' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'KGS' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'GRAM' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'GRAMS' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'G' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'LITER' THEN 'LITER'::public.inventory_unit_type
    WHEN 'LITERS' THEN 'LITER'::public.inventory_unit_type
    WHEN 'LITRE' THEN 'LITER'::public.inventory_unit_type
    WHEN 'LITRES' THEN 'LITER'::public.inventory_unit_type
    WHEN 'L' THEN 'LITER'::public.inventory_unit_type
    WHEN 'MILLILITER' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'MILLILITERS' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'MILLILITRE' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'MILLILITRES' THEN 'MILLILITER'::public.inventory_unit_type
    WHEN 'ML' THEN 'MILLILITER'::public.inventory_unit_type
    ELSE 'PIECE'::public.inventory_unit_type
  END
$$;

CREATE OR REPLACE FUNCTION public.create_inventory_for_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base_unit public.inventory_unit_type;
BEGIN
  v_base_unit := public.normalize_inventory_unit(NEW.unit);

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
  public.normalize_inventory_unit(product.unit)
FROM public.products AS product
ON CONFLICT (product_id) DO NOTHING;
