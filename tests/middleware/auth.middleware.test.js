import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("../../config/supabase.js", () => ({
  default: {
    auth: { getUser },
  },
}));

import authorize from "../../middleware/auth.middleware.js";

describe("authorization middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a bearer token", async () => {
    const next = vi.fn();
    await authorize({ headers: {} }, {}, next);

    expect(getUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("rejects an invalid or expired Supabase token", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    const next = vi.fn();

    await authorize({ headers: { authorization: "Bearer invalid-token" } }, {}, next);

    expect(getUser).toHaveBeenCalledWith("invalid-token");
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid or expired access token", statusCode: 401 }),
    );
  });

  it("attaches a verified Supabase user and token", async () => {
    const user = { id: "user-1", email: "person@example.com" };
    getUser.mockResolvedValue({ data: { user }, error: null });
    const req = { headers: { authorization: "Bearer valid-token" } };
    const next = vi.fn();

    await authorize(req, {}, next);

    expect(req.user).toEqual(user);
    expect(req.accessToken).toBe("valid-token");
    expect(next).toHaveBeenCalledWith();
  });
});
