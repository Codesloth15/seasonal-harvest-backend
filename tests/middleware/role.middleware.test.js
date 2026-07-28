import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuthenticatedSupabaseClient, builder } = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);

  return {
    builder,
    createAuthenticatedSupabaseClient: vi.fn(() => ({
      from: vi.fn(() => builder),
    })),
  };
});

vi.mock("../../config/supabase.js", () => ({ createAuthenticatedSupabaseClient }));

import requireRole from "../../middleware/role.middleware.js";

describe("role middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires prior authentication", async () => {
    const next = vi.fn();
    await requireRole("admin")({}, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(createAuthenticatedSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects an inactive profile", async () => {
    builder.maybeSingle.mockResolvedValue({
      data: { role: "admin", is_active: false },
      error: null,
    });
    const next = vi.fn();

    await requireRole("admin")(
      { user: { id: "user-1" }, accessToken: "token" },
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("rejects a user without an allowed role", async () => {
    builder.maybeSingle.mockResolvedValue({
      data: { role: "employee", is_active: true },
      error: null,
    });
    const next = vi.fn();

    await requireRole("admin", "super_admin")(
      { user: { id: "user-1" }, accessToken: "token" },
      {},
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("allows an active user with an approved role", async () => {
    const profile = { role: "admin", is_active: true };
    builder.maybeSingle.mockResolvedValue({ data: profile, error: null });
    const req = { user: { id: "user-1" }, accessToken: "token" };
    const next = vi.fn();

    await requireRole("admin", "super_admin")(req, {}, next);

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(req.profile).toEqual(profile);
    expect(next).toHaveBeenCalledWith();
  });
});

