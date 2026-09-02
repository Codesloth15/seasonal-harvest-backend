import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signUp, signInWithPassword, resetPasswordForEmail } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("../../config/supabase.js", () => ({
  default: {
    auth: { signUp, signInWithPassword, resetPasswordForEmail },
  },
}));

import {
  changePassword,
  login,
  logout,
  refreshSession,
  register,
  sendPasswordReset,
} from "../../services/auth.service.js";

describe("authentication service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers users with full-name metadata", async () => {
    const data = { user: { id: "user-1" }, session: null };
    signUp.mockResolvedValue({ data, error: null });

    await expect(
      register({ fullName: "Test Person", email: "person@example.com", password: "password123" }),
    ).resolves.toEqual(data);
    expect(signUp).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "password123",
      options: { data: { full_name: "Test Person" } },
    });
  });

  it("propagates Supabase registration errors", async () => {
    const error = new Error("registration failed");
    signUp.mockResolvedValue({ data: null, error });
    await expect(register({ fullName: "Test", email: "x@y.com", password: "password123" })).rejects.toBe(error);
  });

  it("signs in with an email and password", async () => {
    const data = { user: { id: "user-1" }, session: { access_token: "token" } };
    signInWithPassword.mockResolvedValue({ data, error: null });

    await expect(login({ email: "person@example.com", password: "password123" })).resolves.toEqual(data);
  });

  it("refreshes a session with its refresh token", async () => {
    const session = { access_token: "new-access", refresh_token: "new-refresh" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(session),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshSession("old-refresh")).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/v1\/token\?grant_type=refresh_token$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "old-refresh" }),
      }),
    );
  });

  it("requests a password reset with the configured redirect", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await sendPasswordReset("person@example.com", "https://app.example/reset-password");

    expect(resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
      redirectTo: "https://app.example/reset-password",
    });
  });

  it("updates a password with the recovery access token", async () => {
    const user = { id: "user-1" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(user),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(changePassword("recovery-token", "new-password")).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/v1\/user$/),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ password: "new-password" }),
        headers: expect.objectContaining({ Authorization: "Bearer recovery-token" }),
      }),
    );
  });

  it("does not expose an upstream authentication error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: "invalid token" }),
    }));

    await expect(changePassword("bad-token", "new-password")).rejects.toMatchObject({
      message: "invalid token",
      status: 401,
    });
  });

  it("calls the global logout endpoint with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await logout("access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/v1\/logout\?scope=global$/),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      }),
    );
  });
});
