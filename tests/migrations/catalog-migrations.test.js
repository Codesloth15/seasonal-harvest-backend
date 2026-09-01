import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readMigration = (name) =>
  readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");

describe("catalog migrations", () => {
  it("creates profiles through a restricted security-definer trigger", async () => {
    const sql = await readMigration("20260728000004_fix_profile_signup_trigger.sql");

    expect(sql).toMatch(/FUNCTION public\.handle_new_user\(\)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(/INSERT INTO public\.profiles/i);
    expect(sql).toMatch(/REVOKE ALL .* FROM PUBLIC/i);
    expect(sql).toMatch(/AFTER INSERT ON auth\.users/i);
  });

  it("repairs recursive profile policies with security-definer role helpers", async () => {
    const sql = await readMigration("20260728000005_fix_profiles_rls_recursion.sql");

    expect(sql).toMatch(/FUNCTION public\.is_admin_or_super_admin\(\)/i);
    expect(sql).toMatch(/FUNCTION public\.is_super_admin\(\)/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Super admin can view all profiles"/i);
    expect(sql).toMatch(/USING \(public\.is_super_admin\(\)\)/i);
    expect(sql).toMatch(/REVOKE UPDATE ON public\.profiles FROM authenticated/i);
    expect(sql).toMatch(/GRANT UPDATE \(full_name\) ON public\.profiles TO authenticated/i);
    expect(sql).not.toMatch(/IN \(SELECT id FROM (public\.)?profiles/i);
  });

  it("secures the brands table with RLS and least-privilege grants", async () => {
    const sql = await readMigration("20260728000002_create_brands_table.sql");

    expect(sql).toMatch(/CREATE TABLE public\.brands/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/Public can read active brands/i);
    expect(sql).toMatch(/Admins can create brands/i);
    expect(sql).toMatch(/Admins can update brands/i);
    expect(sql).toMatch(/GRANT SELECT ON public\.brands TO anon, authenticated/i);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).* TO anon/i);
  });

  it("creates products with required relationships and business constraints", async () => {
    const sql = await readMigration("20260728000003_create_products_table.sql");

    expect(sql).toMatch(/CREATE TABLE public\.products/i);
    expect(sql).toMatch(/REFERENCES public\.categories\(id\) ON DELETE RESTRICT/i);
    expect(sql).toMatch(/REFERENCES public\.brands\(id\) ON DELETE RESTRICT/i);
    expect(sql).toMatch(/products_price_non_negative/i);
    expect(sql).toMatch(/products_brand_matches_type/i);
    expect(sql).toMatch(/products_sku_unique_ci/i);
    expect(sql).toMatch(/products_barcode_unique/i);
  });

  it("secures product writes for authenticated admins only", async () => {
    const sql = await readMigration("20260728000003_create_products_table.sql");

    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/Public can read active products/i);
    expect(sql).toMatch(/Admins can create products/i);
    expect(sql).toMatch(/Admins can update products/i);
    expect(sql).toMatch(/GRANT SELECT ON public\.products TO anon, authenticated/i);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).* TO anon/i);
  });

  it("adds product packaging and synchronizes it with inventory", async () => {
    const sql = await readMigration("20260826000001_add_product_packaging.sql");

    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS package_unit/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS units_per_package/i);
    expect(sql).toMatch(/products_package_conversion_valid/i);
    expect(sql).toMatch(/sync_product_packaging_to_inventory/i);
    expect(sql).toMatch(/sync_inventory_packaging_to_product/i);
  });
});
