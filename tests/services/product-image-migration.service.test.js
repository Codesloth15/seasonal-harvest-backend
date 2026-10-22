import { describe, expect, it, vi } from "vitest";
import { migrateProductImages } from "../../services/product-image-migration.service.js";

const INLINE = `data:image/png;base64,${Buffer.from("small image bytes").toString("base64")}`;
const STAMP = "2026-10-22T08:00:00.123456+00:00";
const row = (id, image_url = INLINE, updated_at = STAMP) => ({ id, image_url, updated_at });

// The fake implements the HTTP client's query boundary, retaining records so a
// second run can verify that previously migrated rows are skipped.
const fixture = (rows, { updateResults = [], readbackResults = [], profile = { role: "admin", is_active: true } } = {}) => {
  const stored = structuredClone(rows);
  const reads = [];
  const updates = [];
  const getUser = vi.fn(async () => ({ data: { user: { id: "admin-user" } }, error: null }));
  const client = {
    auth: { getUser },
    from: vi.fn((table) => {
      if (table === "profiles") {
        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          maybeSingle: vi.fn(async () => ({ data: profile, error: null })),
        };
        return builder;
      }
      const filters = {};
      let cursor;
      let pageSize;
      let values;
      const builder = {
        select: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn((value) => { pageSize = value; return builder; }),
        gt: vi.fn((_key, value) => { cursor = value; return builder; }),
        eq: vi.fn((key, value) => { filters[key] = value; return builder; }),
        update: vi.fn((value) => { values = value; return builder; }),
        maybeSingle: vi.fn(async () => {
          if (!values) {
            if (readbackResults.length) return readbackResults.shift();
            const current = stored.find((item) => item.id === filters.id);
            return { data: current ? { image_url: current.image_url } : null, error: null };
          }
          updates.push({ filters, values });
          const product = stored.find((item) => item.id === filters.id && item.updated_at === filters.updated_at);
          if (updateResults.length) {
            const result = updateResults.shift();
            if (result.committed && product) Object.assign(product, values);
            return { data: result.data, error: result.error };
          }
          if (product) Object.assign(product, values);
          return { data: product ? { id: product.id } : null, error: null };
        }),
        then: (resolve, reject) => {
          reads.push({ cursor, pageSize });
          const products = stored.filter((product) => !cursor || product.id > cursor)
            .sort((left, right) => left.id.localeCompare(right.id))
            .slice(0, pageSize);
          return Promise.resolve({ data: structuredClone(products), error: null }).then(resolve, reject);
        },
      };
      return builder;
    }),
  };
  const uploadImage = vi.fn(async (id) => ({
    imageUrl: `https://storage.test/product-images/${id}/image.png`,
    objectPath: `${id}/image.png`,
  }));
  const deleteImage = vi.fn(async () => {});
  return { client, uploadImage, deleteImage, getUser, stored, reads, updates };
};

describe("existing product image migration", () => {
  it("defaults to a read-only, deterministic, paginated byte/count report", async () => {
    const state = fixture([
      row("c", "data:image/svg+xml;base64,YQ=="),
      row("a"),
      row("b", "https://storage.test/existing.png"),
      row("d", null),
      row("e"),
    ]);
    const result = await migrateProductImages({ ...state, accessToken: "unused-token", pageSize: 2 });

    expect(result).toMatchObject({
      mode: "dry-run", scanned: 5, embedded: 3, valid: 2, invalid: 1,
      decodedImageBytes: Buffer.byteLength("small image bytes") * 2,
      migrated: 0, conflicts: 0, failed: 0, cleanupFailed: 0,
    });
    expect(result.inlineUrlBytes).toBe(Buffer.byteLength(INLINE) * 2 + Buffer.byteLength("data:image/svg+xml;base64,YQ=="));
    expect(state.reads).toEqual([
      { cursor: undefined, pageSize: 2 },
      { cursor: "b", pageSize: 2 },
      { cursor: "d", pageSize: 2 },
      { cursor: "e", pageSize: 2 },
    ]);
    expect(state.getUser).not.toHaveBeenCalled();
    expect(state.uploadImage).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
    expect(state.deleteImage).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(INLINE);
    expect(JSON.stringify(result)).not.toContain("unused-token");
  });

  it("uploads with user authorization, changes only the original revision, and is rerunnable", async () => {
    const state = fixture([row("b"), row("a")]);
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "user-token", pageSize: 1 });

    expect(result).toMatchObject({ migrated: 2, failed: 0, conflicts: 0 });
    expect(state.getUser).toHaveBeenCalledWith("user-token");
    expect(state.uploadImage).toHaveBeenCalledWith("a", {
      mimetype: "image/png", buffer: Buffer.from("small image bytes"),
    }, "user-token");
    expect(state.updates).toEqual([
      { filters: { id: "a", updated_at: STAMP }, values: { image_url: "https://storage.test/product-images/a/image.png" } },
      { filters: { id: "b", updated_at: STAMP }, values: { image_url: "https://storage.test/product-images/b/image.png" } },
    ]);
    expect(state.deleteImage).not.toHaveBeenCalled();
    const rerun = await migrateProductImages({ ...state });
    expect(rerun).toMatchObject({ scanned: 2, embedded: 0, migrated: 0 });
  });

  it("cleans up a new upload when a concurrent product update wins", async () => {
    const state = fixture([row("a")], { updateResults: [{ data: null, error: null }] });
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "token" });

    expect(result).toMatchObject({ migrated: 0, conflicts: 1, failed: 0 });
    expect(state.deleteImage).toHaveBeenCalledWith("a/image.png", "token");
    expect(state.stored[0].image_url).toBe(INLINE);
  });

  it("cleans up failed updates and counts cleanup failures without exposing raw errors", async () => {
    const state = fixture([row("a")], {
      updateResults: [{ data: null, error: new Error(`sensitive request ${INLINE}`) }],
    });
    state.deleteImage.mockRejectedValue(new Error("sensitive storage error token"));
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "token" });

    expect(result).toMatchObject({ migrated: 0, failed: 1, cleanupFailed: 1 });
    expect(state.deleteImage).toHaveBeenCalledWith("a/image.png", "token");
    expect(JSON.stringify(result)).not.toContain(INLINE);
    expect(JSON.stringify(result)).not.toContain("token");
  });

  it("counts failed uploads and continues to the next product", async () => {
    const state = fixture([row("a"), row("b")]);
    state.uploadImage.mockRejectedValueOnce(new Error("storage unavailable"));
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "token" });
    expect(result).toMatchObject({ migrated: 1, failed: 1 });
    expect(state.deleteImage).not.toHaveBeenCalled();
  });

  it("preserves an uploaded image when an UPDATE commits but its response fails", async () => {
    const state = fixture([row("a")], {
      updateResults: [{ data: null, error: new Error("response lost after commit"), committed: true }],
    });
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "token" });
    expect(result).toMatchObject({ migrated: 1, failed: 0, cleanupFailed: 0 });
    expect(state.stored[0].image_url).toBe("https://storage.test/product-images/a/image.png");
    expect(state.deleteImage).not.toHaveBeenCalled();
  });

  it("preserves an upload and reports unresolved cleanup when UPDATE and readback both fail", async () => {
    const state = fixture([row("a")], {
      updateResults: [{ data: null, error: new Error("response lost") }],
      readbackResults: [{ data: null, error: new Error("readback unavailable") }],
    });
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "token" });
    expect(result).toMatchObject({ migrated: 0, failed: 1, cleanupFailed: 1 });
    expect(state.deleteImage).not.toHaveBeenCalled();
  });

  it("refuses to upload when the optimistic concurrency revision is missing", async () => {
    const state = fixture([row("a", INLINE, null)]);
    const result = await migrateProductImages({ ...state, apply: true, accessToken: "token" });
    expect(result).toMatchObject({ migrated: 0, failed: 1 });
    expect(state.uploadImage).not.toHaveBeenCalled();
  });

  it("refuses --apply without a user token before any network or storage operation", async () => {
    const state = fixture([row("a")]);
    await expect(migrateProductImages({ ...state, apply: true })).rejects.toThrow("PRODUCT_IMAGE_MIGRATION_TOKEN");
    expect(state.client.from).not.toHaveBeenCalled();
    expect(state.getUser).not.toHaveBeenCalled();
    expect(state.uploadImage).not.toHaveBeenCalled();
  });

  it.each([
    { role: "employee", is_active: true },
    { role: "admin", is_active: false },
    null,
  ])("refuses --apply for unauthorized profiles", async (profile) => {
    const state = fixture([row("a")], { profile });
    await expect(migrateProductImages({ ...state, apply: true, accessToken: "token" }))
      .rejects.toThrow("active admin");
    expect(state.uploadImage).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it("refuses invalid or expired user access tokens", async () => {
    const state = fixture([row("a")]);
    state.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    await expect(migrateProductImages({ ...state, apply: true, accessToken: "token" }))
      .rejects.toThrow("authenticated admin");
    expect(state.client.from).not.toHaveBeenCalled();
  });
});
