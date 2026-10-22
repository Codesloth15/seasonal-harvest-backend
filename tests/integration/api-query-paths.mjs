// Run only against a disposable local PostgreSQL cluster:
// node tests/integration/api-query-paths.mjs postgresql://postgres@127.0.0.1:55439/postgres
// Minimal tables exercise the repository's actual RLS policies and role helpers.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const connection = new URL(process.argv[2]);
assert.ok(["127.0.0.1", "localhost"].includes(connection.hostname), "Local test cluster required");
const database = `api_perf_test_${Date.now()}`;
const testConnection = new URL(connection);
testConnection.pathname = `/${database}`;
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const readMigration = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");

const sql = (url, statement) => new Promise((resolve, reject) => {
  const child = spawn("psql", [url.toString(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1"]);
  let output = "";
  let errors = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { errors += data; });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) resolve(output.trim());
    else reject(new Error(errors || `psql exited with ${code}`));
  });
  child.stdin.end(statement);
});

const tables = [
  "public.categories", "public.brands", "public.products", "public.profiles",
  "public.audit_logs", "public.inventory", "public.inventory_transactions", "storage.objects",
];
const snapshot = () => sql(testConnection, `
  SELECT jsonb_build_object(
    'policies', (SELECT jsonb_agg(jsonb_build_array(schemaname, tablename, policyname, permissive, roles, cmd)
      ORDER BY schemaname, tablename, policyname) FROM pg_policies WHERE schemaname IN ('public', 'storage')),
    'table_grants', (SELECT jsonb_agg(jsonb_build_array(n.nspname, c.relname, c.relacl) ORDER BY n.nspname, c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname IN ('public', 'storage')),
    'helper_grants', (SELECT jsonb_agg(jsonb_build_array(proname, proacl) ORDER BY proname)
      FROM pg_proc WHERE proname IN ('is_admin_or_super_admin', 'is_super_admin'))
  );
`);

const accessMatrix = async () => {
  const identities = [
    ["anon", ""], ["authenticated", "employee"], ["authenticated", "admin"],
    ["authenticated", "super_admin"], ["authenticated", "inactive_admin"],
    ["authenticated", "missing_profile"],
  ];
  return Promise.all(identities.map(async ([role, userId]) => {
    const statements = [`BEGIN; SET LOCAL ROLE ${role}; SET LOCAL test.user_id = ${quote(userId)};`];
    for (const table of tables) {
      statements.push(`SELECT jsonb_build_object('table', ${quote(table)},
        'read', public.test_read(${quote(table)}));`);
      const insertValues = table === "public.profiles"
        ? "(id, full_name, role, is_active) VALUES ('new', 'New', 'employee', true)"
        : ["public.brands", "public.products"].includes(table)
          ? "(id, is_active) VALUES ('new', false)"
          : table === "storage.objects"
            ? "(id, bucket_id) VALUES ('new', 'product-images')"
            : "(id) VALUES ('new')";
      const update = table === "public.profiles" ? "full_name = 'Updated'" : "id = id";
      const actions = [
        `INSERT INTO ${table} ${insertValues}`,
        `UPDATE ${table} SET ${update}`,
        `DELETE FROM ${table}`,
      ];
      if (table === "storage.objects") {
        actions.push("INSERT INTO storage.objects (id, bucket_id) VALUES ('new', 'other-bucket')");
      }
      for (const action of actions) {
        statements.push(`SAVEPOINT operation;
          SELECT jsonb_build_object('action', ${quote(action)}, 'result', public.test_write(${quote(action)}));
          ROLLBACK TO SAVEPOINT operation;`);
      }
    }
    statements.push("ROLLBACK;");
    const result = await sql(testConnection, statements.join("\n"));
    return { role, userId, results: result.split("\n").map((line) => JSON.parse(line)) };
  }));
};

await sql(connection, `CREATE DATABASE ${database};`);
try {
  await sql(testConnection, `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('test.user_id', true), '') $$;
    CREATE TABLE public.categories (id text PRIMARY KEY, created_at timestamptz DEFAULT now());
    CREATE TABLE public.brands (id text PRIMARY KEY, is_active boolean, created_at timestamptz DEFAULT now());
    CREATE TABLE public.products (id text PRIMARY KEY, is_active boolean, created_at timestamptz DEFAULT now());
    CREATE TABLE public.profiles (id text PRIMARY KEY, full_name text, role text, is_active boolean);
    CREATE TABLE public.audit_logs (id text PRIMARY KEY);
    CREATE TABLE public.inventory (id text PRIMARY KEY, created_at timestamptz DEFAULT now());
    CREATE TABLE public.inventory_transactions (id text PRIMARY KEY, created_at timestamptz DEFAULT now());
    CREATE TABLE storage.objects (id text PRIMARY KEY, bucket_id text);
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
    GRANT SELECT ON public.categories, public.brands, public.products TO anon, authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.categories, public.brands, public.products TO authenticated;
    GRANT SELECT, INSERT ON public.profiles TO authenticated;
    GRANT UPDATE (full_name) ON public.profiles TO authenticated;
    GRANT SELECT ON public.audit_logs, public.inventory, public.inventory_transactions TO authenticated;
    GRANT UPDATE ON public.inventory TO authenticated;
    GRANT INSERT ON public.inventory_transactions TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
    CREATE FUNCTION public.test_read(table_name text) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE result jsonb;
    BEGIN
      EXECUTE 'SELECT coalesce(jsonb_agg(id ORDER BY id), ''[]''::jsonb) FROM ' || table_name INTO result;
      RETURN result;
    EXCEPTION WHEN insufficient_privilege THEN
      RETURN jsonb_build_object('denied', true);
    END;
    $$;
    CREATE FUNCTION public.test_write(statement text) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE affected integer;
    BEGIN
      EXECUTE statement;
      GET DIAGNOSTICS affected = ROW_COUNT;
      RETURN jsonb_build_object('rows', affected);
    EXCEPTION WHEN insufficient_privilege THEN
      RETURN jsonb_build_object('denied', true);
    END;
    $$;
    INSERT INTO public.profiles VALUES
      ('employee', 'Employee', 'employee', true), ('admin', 'Admin', 'admin', true),
      ('super_admin', 'Super admin', 'super_admin', true), ('inactive_admin', 'Inactive', 'admin', false);
    INSERT INTO public.brands VALUES ('active', true), ('inactive', false);
    INSERT INTO public.products VALUES ('active', true), ('inactive', false);
    INSERT INTO public.categories (id) VALUES ('one'), ('two');
    INSERT INTO public.audit_logs VALUES ('one'), ('two');
    INSERT INTO public.inventory (id) VALUES ('one'), ('two');
    INSERT INTO public.inventory_transactions (id) VALUES ('one'), ('two');
    INSERT INTO storage.objects VALUES ('image', 'product-images'), ('other', 'other-bucket');
    ${tables.map((table) => `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`).join("\n")}
  `);

  const helperMigration = await readMigration("20260728000005_fix_profiles_rls_recursion.sql");
  const helpers = helperMigration.match(/CREATE OR REPLACE FUNCTION public\.is_[\s\S]*?\$\$;/g);
  assert.equal(helpers.length, 2);
  await sql(testConnection, `${helpers.join("\n")}
    REVOKE ALL ON FUNCTION public.is_admin_or_super_admin(), public.is_super_admin() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin(), public.is_super_admin() TO authenticated;`);

  for (const name of [
    "20260424000002_create_auth_and_roles.sql",
    "20260728000001_create_categories_table.sql",
    "20260728000002_create_brands_table.sql",
    "20260728000003_create_products_table.sql",
    "20260728000005_fix_profiles_rls_recursion.sql",
    "20260729000001_create_product_image_storage_policies.sql",
    "20260805000001_create_inventory_adjustments.sql",
  ]) {
    const source = await readMigration(name);
    const policies = source.match(/(?:CREATE POLICY|DROP POLICY)[\s\S]*?;/g);
    assert.ok(policies?.length, `Policy fixture missing in ${name}`);
    await sql(testConnection, policies.join("\n"));
  }

  const beforeMetadata = await snapshot();
  const beforeAccess = await accessMatrix();
  const migration = await readMigration("20261022000001_optimize_api_query_paths.sql");
  await sql(testConnection, migration);
  assert.equal(await snapshot(), beforeMetadata, "Policy roles/commands and table/function grants must remain unchanged");
  assert.deepEqual(await accessMatrix(), beforeAccess, "Read and write permissions must remain equivalent for every identity");

  const plan = await sql(testConnection, `
    SET ROLE authenticated; SET test.user_id = 'admin';
    EXPLAIN (FORMAT JSON) SELECT id FROM public.products;
  `);
  assert.match(plan, /"Parent Relationship": "InitPlan"/, "Role helper must be evaluated through an InitPlan");
  const indexes = await sql(testConnection, `
    SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'
      AND indexname IN ('inventory_created_idx', 'inventory_transactions_created_idx') ORDER BY indexname;
  `);
  assert.equal(indexes.split("\n").length, 2);
  assert.match(indexes, /ON public\.inventory USING btree \(created_at DESC\)/);
  assert.match(indexes, /ON public\.inventory_transactions USING btree \(created_at DESC\)/);

  await sql(testConnection, migration);
  assert.equal(await snapshot(), beforeMetadata, "Migration can be reapplied without changing permission metadata");
  console.log("API query-path PostgreSQL checks passed: 6 identities, read/write permission equivalence, grants/roles, InitPlan, indexes, reapplication.");
} finally {
  await sql(connection, `DROP DATABASE ${database};`);
}
