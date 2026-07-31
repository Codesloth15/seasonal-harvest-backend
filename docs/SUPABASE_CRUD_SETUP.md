# Supabase CRUD Setup

## Purpose

This is the single Supabase setup guide for all currently active Seasonal Harvest backend features. It explains the tables, authentication, role permissions, row-level security (RLS), grants, migrations, and verification steps required for CRUD operations.

Do not place real keys, passwords, access tokens, or service-role credentials in this file.

## Active Supabase features

| Feature | Table or service | Backend CRUD | Migration status |
|---|---|---|---|
| Authentication | Supabase Auth | Sign up, sign in, recovery, reset, current user, sign out | Managed by Supabase Auth |
| User profiles and roles | `profiles` | Database support exists; administration API is not complete | Committed |
| Audit records | `audit_logs` | Database support exists; API is not complete | Committed |
| Inventory | `inventory` | Create, read, update, stock adjustment, and soft delete | Committed |
| Categories | `categories` | Create, read, update, and delete | Committed |
| Products | `products` | Create, read, update, and soft disable | Committed |
| Brands | `brands` | Create, read, update, and hard delete | Committed |

All active Supabase tables now have reproducible migrations in the repository.

## Environment configuration

The backend needs these environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
FRONTEND_URL=https://your-frontend.example
CORS_ORIGINS=https://your-frontend.example
```

Security rules:

- Use the anonymous key in the backend client used by this project.
- Never expose a service-role key to frontend code.
- Do not commit `.env.development.local` or `.env.production.local`.
- Store production values in Railway Variables.
- Configure `<FRONTEND_URL>/reset-password` as an allowed Supabase Auth redirect URL.

## Migration order

Apply migrations in timestamp order:

```text
1. 20260424000001_create_inventory_table.sql
2. 20260424000002_create_auth_and_roles.sql
3. 20260728000001_create_categories_table.sql
4. 20260728000002_create_brands_table.sql
5. 20260728000003_create_products_table.sql
6. 20260728000004_fix_profile_signup_trigger.sql
```

There is currently a dependency issue in this order: the auth-and-roles migration creates an inventory audit trigger, so the inventory migration must run first. The category migration depends on `profiles`, so it must run after the auth-and-roles migration.

Apply committed migrations with:

```bash
supabase link --project-ref <project-reference>
supabase db push
```

For production, run migrations through a controlled deployment step. Do not manually edit production tables without recording an equivalent migration.

## Role model

The `user_role` enum defines:

```text
employee
admin
super_admin
```

Recommended permissions:

| Resource | Anonymous | Employee | Admin | Super admin |
|---|---|---|---|---|
| Read categories | Yes | Yes | Yes | Yes |
| Manage categories | No | No | Yes | Yes |
| Read products | Yes | Yes | Yes | Yes |
| Manage products | No | No | Yes | Yes |
| Read brands | Yes | Yes | Yes | Yes |
| Manage brands | No | No | Yes | Yes |
| Read inventory | Yes, if intentionally public | Yes | Yes | Yes |
| Create inventory | No | Own records, if required | Yes | Yes |
| Update inventory | No | Own records, if required | Yes | Yes |
| Delete inventory | No | Own records, if required | Yes | Yes |
| Read own profile | No | Yes | Yes | Yes |
| Read active user profiles | No | No | Yes | Yes |
| Change roles | No | No | No | Yes |
| Read audit logs | No | No | Yes | Yes |

Confirm the inventory employee policy with the product owner. The committed inventory migration currently allows authenticated owners to create and update their own inventory records, which may be broader than the intended business rules.

## Authentication and profiles

Supabase Auth owns credentials and sessions. The `profiles` table stores application information and authorization roles.

The committed auth migration creates a trigger that inserts a profile whenever a Supabase Auth user is created:

```text
auth.users INSERT
        ↓
handle_new_user()
        ↓
profiles INSERT
```

The backend validates access tokens with Supabase before allowing protected requests. Role-protected routes then load the user's active profile.

The profile trigger runs as a restricted `SECURITY DEFINER` function with an empty search path. This is required because Supabase Auth uses a restricted database role; an invoker-security trigger can fail to insert into `public.profiles` and roll back signup with `Database error saving new user`.

### Creating the first super admin

The first super admin cannot promote itself through the application. Assign the role through a controlled Supabase SQL operation after verifying the user's UUID:

```sql
UPDATE public.profiles
SET role = 'super_admin', updated_at = NOW()
WHERE id = '<verified-auth-user-uuid>';
```

Run this only through an authorized administrator. Verify the target UUID and email before changing the role.

## Categories CRUD

The committed category migration creates:

- `id`
- `name`
- `description`
- `icon`
- `created_at`
- `updated_at`
- Case-insensitive unique category names
- Automatic `updated_at` trigger
- Public read policy
- Active admin/super-admin write policies
- Least-privilege table grants

Category access:

| Operation | Express requirement | Supabase RLS requirement |
|---|---|---|
| Select | Public | `anon` or `authenticated` |
| Insert | Valid token and admin role | Active admin or super admin |
| Update | Valid token and admin role | Active admin or super admin |
| Delete | Valid token and admin role | Active admin or super admin |

The backend passes the user's access token to a user-scoped Supabase client for category writes. This ensures `auth.uid()` and RLS evaluate the real caller.

## Inventory CRUD

The inventory migration defines:

- UUID primary key
- `Wet` and `Dry` category enum values
- Non-negative price and stock constraints
- `created_by` reference to `auth.users`
- Soft deletion using `deleted_at`
- Automatic `updated_at`
- Ownership-based RLS
- Inventory audit trigger

Inventory access in the committed migration:

| Operation | RLS rule |
|---|---|
| Select | Any caller can view non-deleted records |
| Insert | `auth.uid()` must equal `created_by` |
| Update | The caller must own the record |
| Delete | The caller must own the record |

Inventory mutation routes verify the user and pass the caller's bearer token to a user-scoped Supabase client. This allows `auth.uid()` and ownership-based RLS to evaluate the actual caller.

Stock adjustment also uses a read-then-write sequence. Replace it with an atomic PostgreSQL function before high-concurrency production use.

## Brands CRUD

The committed migration creates a `brands` table with:

| Field | Suggested type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | `VARCHAR(100)` | Required and case-insensitively unique |
| `logo_url` | `TEXT` | Optional |
| `is_active` | Boolean | Defaults to `true` |
| `created_at` | Timestamp with time zone | Defaults to `NOW()` |
| `updated_at` | Timestamp with time zone | Defaults to `NOW()` |

Required policies:

| Operation | Recommended policy |
|---|---|
| Select | Public read, or active-only public read |
| Insert | Active admin or super admin |
| Update | Active admin or super admin |
| Delete | Active admin or super admin; referenced brands remain protected by the product foreign key |

Brand reads are public for active records. Brand creation, updates, and deletion require a verified access token and an active `admin` or `super_admin` profile. The model forwards the token through a user-scoped Supabase client, and RLS independently checks the role.

## Products CRUD

The committed migration creates a `products` table with:

| Field | Suggested type | Rules |
|---|---|---|
| `id` | UUID | Primary key |
| `category_id` | UUID | Foreign key to `categories.id` |
| `brand_id` | UUID | Nullable foreign key to `brands.id` |
| `name` | `VARCHAR(150)` | Required |
| `description` | `TEXT` | Optional |
| `product_type` | Enum or constrained text | `BRANDED` or `UNBRANDED` |
| `sku` | `VARCHAR` | Required and unique |
| `barcode` | `VARCHAR` | Optional and unique when present |
| `unit` | `VARCHAR` | Optional or required by business rule |
| `price` | Numeric | Required and non-negative |
| `image_url` | `TEXT` | Optional |
| `is_active` | Boolean | Defaults to `true` |
| `created_at` | Timestamp with time zone | Defaults to `NOW()` |
| `updated_at` | Timestamp with time zone | Defaults to `NOW()` |

Required policies:

| Operation | Recommended policy |
|---|---|
| Select | Public read, preferably active products only for anonymous users |
| Insert | Active admin or super admin |
| Update | Active admin or super admin |
| Delete | Do not expose hard delete; the API sets `is_active = false` |

Product reads are public for active records. Product creation, updates, and soft disabling require a verified access token and an active `admin` or `super_admin` profile. The model forwards the token through a user-scoped Supabase client, and RLS independently checks the role.

SKU generation still counts matching records before insertion and is not collision-safe under concurrency. The database unique index prevents duplicates, but a retry-safe or database-generated sequence is still required for reliable concurrent creation.

## Grants and RLS

PostgreSQL grants and RLS serve different purposes:

- A grant allows a database role to attempt an operation.
- An RLS policy decides which rows that caller may access.
- Both must permit the request.

Recommended pattern:

```sql
ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.example TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.example TO authenticated;

CREATE POLICY "Public can read example"
  ON public.example
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can create example"
  ON public.example
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super_admin());
```

Never grant insert, update, or delete to `anon` for administrative catalog resources.

## Secure admin-role function

The category migration provides `public.is_admin_or_super_admin()`. It is a `SECURITY DEFINER` function with an empty search path, restricted execution, and a minimal boolean result. This prevents category policies from duplicating role logic or exposing profile rows.

Use the same function in future product and brand write policies:

```sql
USING (public.is_admin_or_super_admin())
WITH CHECK (public.is_admin_or_super_admin())
```

Do not create security-definer functions with a caller-controlled search path.

## CRUD verification checklist

Test with separate anonymous, employee, admin, and super-admin sessions.

### Anonymous user

- [ ] Can read intended public categories, products, brands, and inventory.
- [ ] Cannot create, update, or delete categories.
- [ ] Cannot create, update, or disable products or brands.
- [ ] Cannot access profiles or audit logs.

### Employee

- [ ] Can read catalog data.
- [ ] Cannot manage categories, products, or brands.
- [ ] Can read and update only the permitted profile fields.
- [ ] Inventory permissions match the approved business rule.

### Admin

- [ ] Can manage categories.
- [ ] Can manage products and brands after their security work is complete.
- [ ] Cannot assign super-admin privileges.
- [ ] Can read audit information permitted by policy.

### Super admin

- [ ] Can manage categories, products, and brands.
- [ ] Can administer profiles and roles through audited endpoints once implemented.
- [ ] Cannot bypass validation or database constraints.

### General checks

- [ ] Duplicate category and brand names are rejected without regard to case.
- [ ] Negative product and inventory prices are rejected.
- [ ] Negative stock is rejected.
- [ ] Missing, invalid, and expired tokens return `401`.
- [ ] Valid users with insufficient roles receive `403`.
- [ ] API errors do not expose SQL, tokens, keys, or internal stack traces.
- [ ] Every write records the authenticated actor where required.

## Useful verification queries

List expected public tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'audit_logs',
    'inventory',
    'categories',
    'brands',
    'products'
  )
ORDER BY table_name;
```

Check whether RLS is enabled:

```sql
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND relname IN (
    'profiles',
    'audit_logs',
    'inventory',
    'categories',
    'brands',
    'products'
  )
ORDER BY relname;
```

List policies:

```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

List table grants:

```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;
```

Check profiles without exposing authentication secrets:

```sql
SELECT id, email, role, is_active, created_at
FROM public.profiles
ORDER BY created_at DESC;
```

## Production checklist

- [ ] All schema changes exist as committed migrations.
- [x] Products and brands have migrations, constraints, indexes, grants, and RLS.
- [x] Product and brand mutations require authentication and admin roles.
- [x] Inventory writes forward the caller's Supabase token.
- [ ] RLS tests cover anonymous, employee, admin, super-admin, owner, and non-owner cases.
- [ ] Railway contains only required production environment variables.
- [ ] The Supabase service-role key is absent from frontend builds.
- [ ] Backups and restoration have been tested.
- [ ] Migration rollback or forward-fix procedures are documented.
- [ ] Audit logs and authentication events are monitored without storing secrets.

## Related documentation

- `docs/API_ENDPOINTS.md`
- `docs/AUTH.md`
- `docs/CATEGORY_MODULE.md`
- `docs/INVENTORY_SETUP.md`
- `docs/PRODUCT_MODULE.md`
- `docs/BRAND_MODULE.md`
- `docs/PROGRESS.md`
