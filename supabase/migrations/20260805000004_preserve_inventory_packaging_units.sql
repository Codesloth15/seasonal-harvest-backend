-- Preserve the product's packaging unit instead of collapsing it to PIECE.
CREATE OR REPLACE FUNCTION public.normalize_inventory_unit(p_unit TEXT)
RETURNS public.inventory_unit_type
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE upper(btrim(COALESCE(p_unit, '')))
    WHEN 'BOX' THEN 'BOX'::public.inventory_unit_type WHEN 'BOXES' THEN 'BOX'::public.inventory_unit_type
    WHEN 'PACK' THEN 'PACK'::public.inventory_unit_type WHEN 'PACKS' THEN 'PACK'::public.inventory_unit_type WHEN 'PK' THEN 'PACK'::public.inventory_unit_type
    WHEN 'BALE' THEN 'BALE'::public.inventory_unit_type WHEN 'BALES' THEN 'BALE'::public.inventory_unit_type
    WHEN 'SACK' THEN 'SACK'::public.inventory_unit_type WHEN 'SACKS' THEN 'SACK'::public.inventory_unit_type
    WHEN 'CRATE' THEN 'CRATE'::public.inventory_unit_type WHEN 'CRATES' THEN 'CRATE'::public.inventory_unit_type
    WHEN 'TRAY' THEN 'TRAY'::public.inventory_unit_type WHEN 'TRAYS' THEN 'TRAY'::public.inventory_unit_type
    WHEN 'BUNDLE' THEN 'BUNDLE'::public.inventory_unit_type WHEN 'BUNDLES' THEN 'BUNDLE'::public.inventory_unit_type
    WHEN 'PIECE' THEN 'PIECE'::public.inventory_unit_type WHEN 'PIECES' THEN 'PIECE'::public.inventory_unit_type WHEN 'PC' THEN 'PIECE'::public.inventory_unit_type WHEN 'PCS' THEN 'PIECE'::public.inventory_unit_type
    WHEN 'KILOGRAM' THEN 'KILOGRAM'::public.inventory_unit_type WHEN 'KILOGRAMS' THEN 'KILOGRAM'::public.inventory_unit_type WHEN 'KG' THEN 'KILOGRAM'::public.inventory_unit_type WHEN 'KGS' THEN 'KILOGRAM'::public.inventory_unit_type
    WHEN 'GRAM' THEN 'GRAM'::public.inventory_unit_type WHEN 'GRAMS' THEN 'GRAM'::public.inventory_unit_type WHEN 'G' THEN 'GRAM'::public.inventory_unit_type
    WHEN 'LITER' THEN 'LITER'::public.inventory_unit_type WHEN 'LITERS' THEN 'LITER'::public.inventory_unit_type WHEN 'LITRE' THEN 'LITER'::public.inventory_unit_type WHEN 'LITRES' THEN 'LITER'::public.inventory_unit_type WHEN 'L' THEN 'LITER'::public.inventory_unit_type
    WHEN 'MILLILITER' THEN 'MILLILITER'::public.inventory_unit_type WHEN 'MILLILITERS' THEN 'MILLILITER'::public.inventory_unit_type WHEN 'MILLILITRE' THEN 'MILLILITER'::public.inventory_unit_type WHEN 'MILLILITRES' THEN 'MILLILITER'::public.inventory_unit_type WHEN 'ML' THEN 'MILLILITER'::public.inventory_unit_type
    ELSE 'PIECE'::public.inventory_unit_type
  END
$$;

CREATE OR REPLACE FUNCTION public.create_inventory_for_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.inventory (product_id, base_unit)
  VALUES (NEW.id, public.normalize_inventory_unit(NEW.unit))
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

UPDATE public.inventory AS inventory
SET base_unit = public.normalize_inventory_unit(product.unit)
FROM public.products AS product
WHERE inventory.product_id = product.id;
