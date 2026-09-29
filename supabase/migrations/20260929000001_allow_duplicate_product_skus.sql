-- SKUs are manually assigned labels and are not required to identify a product.
-- Product IDs remain the canonical unique identifiers.
DROP INDEX IF EXISTS public.products_sku_unique_ci;

-- Preserve efficient case-insensitive SKU lookups without enforcing uniqueness.
CREATE INDEX IF NOT EXISTS products_sku_ci_idx
  ON public.products (lower(btrim(sku)));
