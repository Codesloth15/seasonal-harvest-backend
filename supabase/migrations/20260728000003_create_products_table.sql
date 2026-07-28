CREATE TYPE public.product_type AS ENUM ('BRANDED', 'UNBRANDED');

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES public.brands(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  product_type public.product_type NOT NULL,
  sku VARCHAR(64) NOT NULL,
  barcode VARCHAR(128),
  unit VARCHAR(50),
  price NUMERIC(12, 2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT products_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT products_sku_not_blank CHECK (char_length(btrim(sku)) > 0),
  CONSTRAINT products_price_non_negative CHECK (price >= 0),
  CONSTRAINT products_description_length CHECK (
    description IS NULL OR char_length(description) <= 5000
  ),
  CONSTRAINT products_image_url_length CHECK (
    image_url IS NULL OR char_length(image_url) <= 2048
  ),
  CONSTRAINT products_brand_matches_type CHECK (
    (product_type = 'BRANDED' AND brand_id IS NOT NULL)
    OR (product_type = 'UNBRANDED' AND brand_id IS NULL)
  )
);

CREATE UNIQUE INDEX products_sku_unique_ci
  ON public.products (lower(btrim(sku)));

CREATE UNIQUE INDEX products_barcode_unique
  ON public.products (barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX products_category_idx ON public.products (category_id);
CREATE INDEX products_brand_idx ON public.products (brand_id);
CREATE INDEX products_active_created_idx ON public.products (is_active, created_at DESC);
CREATE INDEX products_name_idx ON public.products (name);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active products"
  ON public.products
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated users can read permitted products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super_admin());

CREATE POLICY "Admins can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

CREATE POLICY "Admins can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super_admin());

CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_updated_at_trigger
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_products_updated_at();

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
