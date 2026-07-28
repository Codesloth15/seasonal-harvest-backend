-- Reusable role check that bypasses profile RLS without exposing profile data.
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated;

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT categories_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT categories_description_length CHECK (
    description IS NULL OR char_length(description) <= 1000
  ),
  CONSTRAINT categories_icon_length CHECK (
    icon IS NULL OR char_length(icon) <= 500
  )
);

CREATE UNIQUE INDEX categories_name_unique_ci
  ON public.categories (lower(btrim(name)));

CREATE INDEX categories_created_at_idx ON public.categories (created_at DESC);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can create categories"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super_admin());

CREATE POLICY "Admins can update categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

CREATE POLICY "Admins can delete categories"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super_admin());

CREATE OR REPLACE FUNCTION public.update_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_updated_at_trigger
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_categories_updated_at();

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
