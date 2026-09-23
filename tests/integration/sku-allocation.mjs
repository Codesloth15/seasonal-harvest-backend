// Run against a disposable local PostgreSQL cluster, never production:
// node tests/integration/sku-allocation.mjs postgresql://postgres@127.0.0.1:55439/postgres
// Real database locking; minimal catalog and role-helper fixtures.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const url = new URL(process.argv[2]);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Local test cluster required");
const database = `sku_test_${Date.now()}`;
const sql = async (connection, query) => {
  const { stdout } = await exec("psql", [connection.toString(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", query]);
  return stdout.trim();
};
const testUrl = new URL(url);
testUrl.pathname = `/${database}`;
await sql(url, `CREATE DATABASE ${database}`);
try {
  await sql(testUrl, `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$;
    CREATE TABLE public.products (sku text, is_active boolean DEFAULT true);
    CREATE UNIQUE INDEX products_sku_unique_ci ON public.products (lower(btrim(sku)));
    CREATE FUNCTION public.is_admin_or_super_admin() RETURNS boolean LANGUAGE sql AS
      $$ SELECT coalesce(current_setting('test.admin', true), 'false') = 'true' $$;
    INSERT INTO products VALUES ('CDO-CHICKEN-001', true), ('cdo-chicken-003', false), ('UNB-RICE-999', true);
  `);
  const migration = await readFile(new URL("../../supabase/migrations/20260923000001_allocate_product_sku.sql", import.meta.url), "utf8");
  await sql(testUrl, migration);
  const allocate = (prefix) => sql(testUrl, `SET ROLE authenticated; SET test.admin = 'true'; SELECT public.allocate_product_sku('${prefix}');`);
  assert.equal(await allocate("CDO-CHICKEN"), "CDO-CHICKEN-004", "Seed includes inactive rows and deletion gaps");
  await sql(testUrl, "DELETE FROM products WHERE lower(sku) LIKE 'cdo-chicken-%'");
  assert.equal(await allocate("CDO-CHICKEN"), "CDO-CHICKEN-005", "Deletion does not reset allocation");
  assert.equal(await allocate("UNB-RICE"), "UNB-RICE-1000", "Suffix must not truncate");
  const results = await Promise.all(Array.from({ length: 24 }, () => allocate("NEW-PRODUCT")));
  assert.equal(new Set(results).size, 24, "Concurrent first allocations must be unique");
  assert.deepEqual(results.map(value => Number(value.split("-").at(-1))).sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i + 1));
  await assert.rejects(sql(testUrl, "SET ROLE anon; SELECT public.allocate_product_sku('UNB-RICE');"), /permission denied/);
  await assert.rejects(sql(testUrl, "SET ROLE authenticated; SELECT public.allocate_product_sku('UNB-RICE');"), /administrator role required/);
  await assert.rejects(sql(testUrl, "SET ROLE authenticated; SELECT * FROM product_sku_counters;"), /permission denied/);
  await assert.rejects(allocate("INVALID-PREFIX-LONG"), /Invalid SKU prefix/);
  console.log("SKU PostgreSQL checks passed: legacy gaps, inactive rows, deletion, >999, 24 concurrent allocations, permissions, validation.");
} finally {
  await sql(url, `DROP DATABASE ${database}`);
}
