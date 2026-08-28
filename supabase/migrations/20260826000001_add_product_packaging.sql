-- Expose catalog packaging on products and keep it synchronized with inventory.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS package_unit public.inventory_unit_type,
  ADD COLUMN IF NOT EXISTS units_per_package NUMERIC NOT NULL DEFAULT 1;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_package_conversion_valid;
ALTER TABLE public.products
  ADD CONSTRAINT products_package_conversion_valid CHECK (
    (package_unit IS NULL AND units_per_package = 1)
    OR
    (package_unit IS NOT NULL
      AND package_unit <> public.normalize_inventory_unit(unit)
      AND units_per_package > 1)
  );

-- Preserve packaging already configured through the inventory endpoint.
UPDATE public.products AS product
SET
  package_unit = inventory.package_unit,
  units_per_package = inventory.units_per_package
FROM public.inventory AS inventory
WHERE inventory.product_id = product.id
  AND inventory.package_unit IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_inventory_for_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.inventory (
    product_id, base_unit, package_unit, units_per_package
  ) VALUES (
    NEW.id, public.normalize_inventory_unit(NEW.unit),
    NEW.package_unit, NEW.units_per_package
  )
  ON CONFLICT (product_id) DO UPDATE SET
    base_unit = EXCLUDED.base_unit,
    package_unit = EXCLUDED.package_unit,
    units_per_package = EXCLUDED.units_per_package;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_packaging_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.inventory
  SET
    base_unit = public.normalize_inventory_unit(NEW.unit),
    package_unit = NEW.package_unit,
    units_per_package = NEW.units_per_package
  WHERE product_id = NEW.id
    AND (base_unit, package_unit, units_per_package) IS DISTINCT FROM
      (public.normalize_inventory_unit(NEW.unit), NEW.package_unit, NEW.units_per_package);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_packaging_to_inventory_trigger ON public.products;
CREATE TRIGGER sync_product_packaging_to_inventory_trigger
AFTER UPDATE OF unit, package_unit, units_per_package ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_packaging_to_inventory();

CREATE OR REPLACE FUNCTION public.sync_inventory_packaging_to_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.products
  SET
    unit = NEW.base_unit::TEXT,
    package_unit = NEW.package_unit,
    units_per_package = NEW.units_per_package
  WHERE id = NEW.product_id
    AND (public.normalize_inventory_unit(unit), package_unit, units_per_package) IS DISTINCT FROM
      (NEW.base_unit, NEW.package_unit, NEW.units_per_package);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_inventory_packaging_to_product_trigger ON public.inventory;
CREATE TRIGGER sync_inventory_packaging_to_product_trigger
AFTER UPDATE OF base_unit, package_unit, units_per_package ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.sync_inventory_packaging_to_product();

-- Reconcile every inventory row with the now catalog-visible product values.
UPDATE public.inventory AS inventory
SET
  base_unit = public.normalize_inventory_unit(product.unit),
  package_unit = product.package_unit,
  units_per_package = product.units_per_package
FROM public.products AS product
WHERE inventory.product_id = product.id
  AND (inventory.base_unit, inventory.package_unit, inventory.units_per_package) IS DISTINCT FROM
    (public.normalize_inventory_unit(product.unit), product.package_unit, product.units_per_package);
