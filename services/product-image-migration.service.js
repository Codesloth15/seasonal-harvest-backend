import { parseEmbeddedProductImage } from "../utils/product-image.js";

const migrationError = (message) => new Error(message);

const requireAdmin = async (client, accessToken) => {
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    throw migrationError("An authenticated admin access token is required for --apply.");
  }
  const { data: profile, error: profileError } = await client.from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile?.is_active || !["admin", "super_admin"].includes(profile.role)) {
    throw migrationError("An active admin or super_admin account is required for --apply.");
  }
};

/**
 * Dry-run by default. The caller supplies a public client for inspection, or a
 * client authenticated as an application admin for apply. No service-role key.
 * Only counts and byte totals leave this function; image contents never do.
 */
export const migrateProductImages = async ({
  client,
  apply = false,
  accessToken,
  uploadImage,
  deleteImage,
  pageSize = 100,
}) => {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw migrationError("Migration page size must be between 1 and 1000.");
  }
  if (apply) {
    if (typeof accessToken !== "string" || !accessToken.trim()) {
      throw migrationError("Set PRODUCT_IMAGE_MIGRATION_TOKEN to an admin access token for --apply.");
    }
    if (typeof uploadImage !== "function" || typeof deleteImage !== "function") {
      throw migrationError("Image storage upload and cleanup functions are required for --apply.");
    }
    await requireAdmin(client, accessToken);
  }

  const summary = {
    mode: apply ? "apply" : "dry-run",
    scanned: 0,
    embedded: 0,
    valid: 0,
    invalid: 0,
    inlineUrlBytes: 0,
    decodedImageBytes: 0,
    migrated: 0,
    conflicts: 0,
    failed: 0,
    cleanupFailed: 0,
  };

  let lastId;
  while (true) {
    // A stable primary-key cursor avoids skipping rows when URLs are replaced,
    // and keeps reads bounded even when there are more than 1000 products.
    let query = client.from("products")
      .select("id, image_url, updated_at")
      .order("id", { ascending: true })
      .limit(pageSize);
    if (lastId !== undefined) query = query.gt("id", lastId);
    const { data: products, error } = await query;
    if (error || !Array.isArray(products)) {
      throw migrationError("Could not read product image migration source.");
    }
    if (products.length === 0) break;

    for (const product of products) {
      summary.scanned++;
      let image;
      if (typeof product.image_url === "string" && /^data:/i.test(product.image_url.trimStart())) {
        summary.embedded++;
        summary.inlineUrlBytes += Buffer.byteLength(product.image_url, "utf8");
      }
      try {
        image = parseEmbeddedProductImage(product.image_url);
      } catch {
        summary.invalid++;
        continue;
      }
      if (!image) continue;
      summary.valid++;
      summary.decodedImageBytes += image.buffer.length;
      if (!apply) continue;

      // The table's BEFORE UPDATE trigger changes updated_at on every write.
      // CAS on that revision avoids sending a base64 URL in a query-string
      // filter, and refuses to replace a product changed after it was read.
      if (typeof product.updated_at !== "string" || !Number.isFinite(Date.parse(product.updated_at))) {
        summary.failed++;
        continue;
      }

      let uploaded;
      let updateAttempted = false;
      try {
        uploaded = await uploadImage(product.id, image, accessToken);
        if (!uploaded?.objectPath || !uploaded?.imageUrl) {
          throw migrationError("Image storage returned an incomplete upload result.");
        }
        updateAttempted = true;
        const { data: updated, error: updateError } = await client.from("products")
          .update({ image_url: uploaded.imageUrl })
          .eq("id", product.id)
          .eq("updated_at", product.updated_at)
          .select("id")
          .maybeSingle();
        if (updateError) throw updateError;
        if (updated) {
          summary.migrated++;
          continue;
        }
        summary.conflicts++;
      } catch {
        // A failed HTTP response does not prove the UPDATE rolled back. Check
        // the stored URL before cleanup so a committed image is never deleted.
        if (updateAttempted && uploaded?.imageUrl) {
          try {
            const { data: current, error: readError } = await client.from("products")
              .select("image_url")
              .eq("id", product.id)
              .maybeSingle();
            if (readError || current === undefined ||
              (current !== null && !Object.hasOwn(current, "image_url"))) {
              throw migrationError("Could not determine whether the image update committed.");
            }
            if (current?.image_url === uploaded.imageUrl) {
              summary.migrated++;
              continue;
            }
          } catch {
            // Preserve the upload when its reference cannot be verified. An
            // operator can investigate without a broken product image.
            summary.failed++;
            summary.cleanupFailed++;
            continue;
          }
        }
        summary.failed++;
      }

      if (uploaded?.objectPath) {
        try {
          await deleteImage(uploaded.objectPath, accessToken);
        } catch {
          summary.cleanupFailed++;
        }
      }
    }

    const nextId = products.at(-1)?.id;
    if (!nextId || nextId === lastId) {
      throw migrationError("Product migration source did not advance its primary-key cursor.");
    }
    lastId = nextId;
  }
  return summary;
};
