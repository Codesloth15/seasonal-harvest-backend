CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT brands_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT brands_logo_url_length CHECK (
    logo_url IS NULL OR char_length(logo_url) <= 2048
  )
);

CREATE UNIQUE INDEX brands_name_unique_ci
  ON public.brands (lower(btrim(name)));

CREATE INDEX brands_active_name_idx
  ON public.brands (is_active, name);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active brands"
  ON public.brands
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated users can read permitted brands"
  ON public.brands
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can create brands"
  ON public.brands
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super_admin());

CREATE POLICY "Admins can update brands"
  ON public.brands
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

CREATE POLICY "Admins can delete brands"
  ON public.brands
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super_admin());

CREATE OR REPLACE FUNCTION public.update_brands_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER brands_updated_at_trigger
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_brands_updated_at();

GRANT SELECT ON public.brands TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.brands TO authenticated;

