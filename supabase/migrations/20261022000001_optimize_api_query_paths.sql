-- Global dashboard/history queries do not filter by inventory_id or product_id,
-- so their date filters and ordering need a standalone index.
CREATE INDEX IF NOT EXISTS inventory_transactions_created_idx
  ON public.inventory_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_created_idx
  ON public.inventory (created_at DESC);

-- These helpers depend only on the authenticated caller, never on row values.
-- Scalar subqueries let PostgreSQL evaluate them once per statement (InitPlan).
-- ALTER POLICY keeps each policy's roles, command, and permissiveness intact;
-- table/function grants and the permission predicates are unchanged.
ALTER POLICY "Admins can create categories" ON public.categories
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can update categories" ON public.categories
  USING ((SELECT public.is_admin_or_super_admin()))
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can delete categories" ON public.categories
  USING ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Authenticated users can read permitted brands" ON public.brands
  USING (is_active = true OR (SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can create brands" ON public.brands
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can update brands" ON public.brands
  USING ((SELECT public.is_admin_or_super_admin()))
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can delete brands" ON public.brands
  USING ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Authenticated users can read permitted products" ON public.products
  USING (is_active = true OR (SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can create products" ON public.products
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can update products" ON public.products
  USING ((SELECT public.is_admin_or_super_admin()))
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can delete products" ON public.products
  USING ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Users can view their own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id);

ALTER POLICY "Users can update their own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "Super admin can view all profiles" ON public.profiles
  USING ((SELECT public.is_super_admin()));

ALTER POLICY "Admin can view all active profiles" ON public.profiles
  USING (is_active = true AND (SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Super admin can update any profile" ON public.profiles
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

ALTER POLICY "Super admin can delete profiles" ON public.profiles
  USING ((SELECT public.is_super_admin()));

ALTER POLICY "Super admin can insert profiles" ON public.profiles
  WITH CHECK ((SELECT public.is_super_admin()));

ALTER POLICY "Audit logs are viewable by admins only" ON public.audit_logs
  USING ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can update inventory" ON public.inventory
  USING ((SELECT public.is_admin_or_super_admin()))
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can create inventory transactions" ON public.inventory_transactions
  WITH CHECK ((SELECT public.is_admin_or_super_admin()));

ALTER POLICY "Admins can upload product images" ON storage.objects
  WITH CHECK (
    bucket_id = 'product-images'
    AND (SELECT public.is_admin_or_super_admin())
  );

ALTER POLICY "Admins can update product images" ON storage.objects
  USING (
    bucket_id = 'product-images'
    AND (SELECT public.is_admin_or_super_admin())
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (SELECT public.is_admin_or_super_admin())
  );

ALTER POLICY "Admins can delete product images" ON storage.objects
  USING (
    bucket_id = 'product-images'
    AND (SELECT public.is_admin_or_super_admin())
  );
