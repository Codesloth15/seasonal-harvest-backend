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
    const user = {
      id: "user-1",
      email: "person@example.com",
      app_metadata: { role: "admin" },
      user_metadata: { name: "Person" },
      identities: [{ id: "identity-1", provider: "email" }],
    };
    getUser.mockResolvedValue({ data: { user }, error: null });
    const req = { headers: { authorization: "Bearer valid-token" } };
    const next = vi.fn();

    await authorize(req, {}, next);

    expect(req.user).toBe(user);
    expect(req.accessToken).toBe("valid-token");
    expect(next).toHaveBeenCalledWith();
  });

  it("shares only an in-flight verification for concurrent requests with the same token", async () => {
    let resolveVerification;
    getUser.mockReturnValueOnce(new Promise((resolve) => { resolveVerification = resolve; }));
    const requests = [
      { headers: { authorization: "Bearer shared-token" } },
      { headers: { authorization: "Bearer shared-token" } },
    ];
    const callbacks = [vi.fn(), vi.fn()];
    const pending = requests.map((req, index) => authorize(req, {}, callbacks[index]));

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(callbacks[0]).not.toHaveBeenCalled();
    expect(callbacks[1]).not.toHaveBeenCalled();

    const user = { id: "user-1", app_metadata: { role: "admin" } };
    resolveVerification({ data: { user }, error: null });
    await Promise.all(pending);

    for (const [index, req] of requests.entries()) {
      expect(req.user).toBe(user);
      expect(req.accessToken).toBe("shared-token");
      expect(callbacks[index]).toHaveBeenCalledWith();
    }

    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("revoked") });
    const next = vi.fn();
    await authorize({ headers: { authorization: "Bearer shared-token" } }, {}, next);

    expect(getUser).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("verifies different tokens separately even while another verification is in flight", async () => {
    let resolveFirst;
    getUser.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    const user = { id: "user-2" };
    getUser.mockResolvedValueOnce({ data: { user }, error: null });
    const firstNext = vi.fn();
    const first = authorize({ headers: { authorization: "Bearer token-a" } }, {}, firstNext);
    const secondReq = { headers: { authorization: "Bearer token-b" } };
    const secondNext = vi.fn();

    await authorize(secondReq, {}, secondNext);

    expect(getUser).toHaveBeenNthCalledWith(1, "token-a");
    expect(getUser).toHaveBeenNthCalledWith(2, "token-b");
    expect(firstNext).not.toHaveBeenCalled();
    expect(secondReq.user).toBe(user);
    expect(secondNext).toHaveBeenCalledWith();

    resolveFirst({ data: { user: { id: "user-1" } }, error: null });
    await first;
    expect(firstNext).toHaveBeenCalledWith();
  });

  it("clears a shared unsuccessful verification so a later request checks Supabase again", async () => {
    let resolveVerification;
    getUser.mockReturnValueOnce(new Promise((resolve) => { resolveVerification = resolve; }));
    const callbacks = [vi.fn(), vi.fn()];
    const pending = callbacks.map((next) => authorize(
      { headers: { authorization: "Bearer invalid-shared-token" } }, {}, next,
    ));

    expect(getUser).toHaveBeenCalledTimes(1);
    resolveVerification({ data: { user: null }, error: new Error("expired") });
    await Promise.all(pending);

    for (const next of callbacks) {
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid or expired access token", statusCode: 401 }),
      );
    }

    const user = { id: "user-1" };
    getUser.mockResolvedValueOnce({ data: { user }, error: null });
    const req = { headers: { authorization: "Bearer invalid-shared-token" } };
    const next = vi.fn();
    await authorize(req, {}, next);

    expect(getUser).toHaveBeenCalledTimes(2);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("clears a rejected shared verification and preserves the original error", async () => {
    let rejectVerification;
    getUser.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectVerification = reject; }));
    const callbacks = [vi.fn(), vi.fn()];
    const pending = callbacks.map((next) => authorize(
      { headers: { authorization: "Bearer rejected-token" } }, {}, next,
    ));

    expect(getUser).toHaveBeenCalledTimes(1);
    const failure = new Error("Supabase unavailable");
    rejectVerification(failure);
    await Promise.all(pending);

    for (const next of callbacks) expect(next).toHaveBeenCalledWith(failure);

    const user = { id: "user-1" };
    getUser.mockResolvedValueOnce({ data: { user }, error: null });
    const req = { headers: { authorization: "Bearer rejected-token" } };
    const next = vi.fn();
    await authorize(req, {}, next);

    expect(getUser).toHaveBeenCalledTimes(2);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledWith();
  });
});
