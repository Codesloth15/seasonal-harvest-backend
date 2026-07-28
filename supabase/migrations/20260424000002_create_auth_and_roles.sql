-- Create roles enum
CREATE TYPE user_role AS ENUM ('employee', 'admin', 'super_admin');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role user_role DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super admin can view all profiles" ON profiles
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
  );

CREATE POLICY "Admin can view all active profiles" ON profiles
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admin can update any profile" ON profiles
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
  );

CREATE POLICY "Super admin can delete profiles" ON profiles
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
  );

CREATE POLICY "Super admin can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
  );

-- RLS Policies for audit_logs
CREATE POLICY "Audit logs are viewable by admins only" ON audit_logs
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Audit logs are insertable by system" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Create function to update profile updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'employee',
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create function to log changes to inventory
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    'inventory',
    NEW.id,
    row_to_json(OLD),
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inventory audit log
CREATE TRIGGER inventory_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON inventory
FOR EACH ROW
EXECUTE FUNCTION log_inventory_changes();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
