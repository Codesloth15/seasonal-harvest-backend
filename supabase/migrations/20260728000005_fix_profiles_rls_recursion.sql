-- Repair recursive profiles RLS policies and restrict direct profile updates.
-- A SECURITY DEFINER function owned by the migration owner evaluates the role
-- without invoking profiles RLS again.

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

CREATE OR REPLACE FUNCTION public.is_super_admin()
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
      AND role = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.profiles;

CREATE POLICY "Super admin can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admin can view all active profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (is_active = true AND public.is_admin_or_super_admin());

CREATE POLICY "Super admin can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admin can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Audit logs are viewable by admins only" ON public.audit_logs;

CREATE POLICY "Audit logs are viewable by admins only"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super_admin());

-- Prevent users from changing role, activation, identity, or audit columns via
-- the Data API. A future admin workflow should use a narrowly scoped RPC.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
