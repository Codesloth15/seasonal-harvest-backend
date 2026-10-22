import { migrateProductImages } from "../services/product-image-migration.service.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node scripts/migrate-product-images.mjs [--dry-run | --apply]");
  console.log("Defaults to read-only inspection using local SUPABASE_URL and SUPABASE_ANON_KEY.");
  console.log("--apply requires PRODUCT_IMAGE_MIGRATION_TOKEN with an active admin user's access token.");
  console.log("Reports counts and byte totals only; never prints image data or credentials.");
} else if (args.some((arg) => !["--dry-run", "--apply"].includes(arg)) ||
  (args.includes("--dry-run") && args.includes("--apply"))) {
  console.error("Use either --dry-run or --apply. Run with --help for usage.");
  process.exitCode = 1;
} else {
  try {
    const apply = args.includes("--apply");
    const accessToken = apply ? process.env.PRODUCT_IMAGE_MIGRATION_TOKEN : undefined;
    if (apply && !accessToken?.trim()) {
      throw new Error("Missing admin token");
    }
    // Keep the existing local configuration loader quiet for a machine-readable
    // report. The token is read only from the environment, never command args.
    process.env.DOTENV_CONFIG_QUIET = "true";
    const { default: publicClient, createAuthenticatedSupabaseClient } = await import("../config/supabase.js");
    const { uploadProductImage, deleteProductImage } = await import("../services/product-image.service.js");
    const summary = await migrateProductImages({
      client: apply ? createAuthenticatedSupabaseClient(accessToken) : publicClient,
      apply,
      accessToken,
      uploadImage: uploadProductImage,
      deleteImage: deleteProductImage,
    });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.failed || summary.cleanupFailed || summary.invalid || summary.conflicts) {
      process.exitCode = 1;
    }
  } catch {
    // Storage/database errors can contain request details. Keep raw errors,
    // tokens, IDs, and inline image contents out of maintenance output.
    console.error("Product image migration stopped. Check local Supabase configuration, network access, and (for --apply) an active admin access token.");
    process.exitCode = 1;
  }
}
