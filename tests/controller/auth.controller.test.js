import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/auth.service.js", () => ({
  register: vi.fn(),
  login: vi.fn(),
  sendPasswordReset: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}));

import * as AuthService from "../../services/auth.service.js";
import {
  forgotPassword,
  getCurrentUser,
  resetPassword,
  refreshSession,
  signIn,
  signOut,
  signUp,
} from "../../controller/auth.controller.js";

const createResponse = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const createRequest = ({ body = {}, authorization, user } = {}) => ({
  body,
  headers: authorization ? { authorization } : {},
  user,
});

describe("authentication controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a normalized user and never returns a password", async () => {
    const user = { id: "user-1", email: "person@example.com" };
    AuthService.register.mockResolvedValue({ user, session: null });
    const req = createRequest({
      body: { fullName: "  Test Person  ", email: " PERSON@EXAMPLE.COM ", password: "password123" },
    });
    const res = createResponse();
    const next = vi.fn();

    await signUp(req, res, next);

    expect(AuthService.register).toHaveBeenCalledWith({
      fullName: "Test Person",
      email: "person@example.com",
      password: "password123",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data).toEqual({ user, session: null });
    expect(res.json.mock.calls[0][0]).not.toHaveProperty("password");
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    [{ fullName: "", email: "person@example.com", password: "password123" }, "Full name"],
    [{ fullName: "Test Person", email: "invalid", password: "password123" }, "valid email"],
    [{ fullName: "Test Person", email: "person@example.com", password: "short" }, "8 characters"],
  ])("rejects invalid registration input", async (body, message) => {
    const next = vi.fn();
    await signUp(createRequest({ body }), createResponse(), next);

    expect(AuthService.register).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(next.mock.calls[0][0].message).toContain(message);
  });

  it("returns a Supabase session after successful sign-in", async () => {
    const data = { user: { id: "user-1" }, session: { access_token: "token" } };
    AuthService.login.mockResolvedValue(data);
    const res = createResponse();
    const next = vi.fn();

    await signIn(
      createRequest({ body: { email: " PERSON@EXAMPLE.COM ", password: "password123" } }),
      res,
      next,
    );

    expect(AuthService.login).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "password123",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toEqual(data);
    expect(next).not.toHaveBeenCalled();
  });

  it("refreshes a stored session", async () => {
    const data = { user: { id: "user-1" }, access_token: "new-access", refresh_token: "new-refresh" };
    AuthService.refreshSession.mockResolvedValue(data);
    const res = createResponse();
    const next = vi.fn();

    await refreshSession(createRequest({ body: { refreshToken: "old-refresh" } }), res, next);

    expect(AuthService.refreshSession).toHaveBeenCalledWith("old-refresh");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toEqual({ user: data.user, session: data });
    expect(next).not.toHaveBeenCalled();
  });

  it("maps Supabase credential failures to a generic 401 response", async () => {
    AuthService.login.mockRejectedValue(new Error("Invalid login credentials"));
    const next = vi.fn();

    await signIn(
      createRequest({ body: { email: "person@example.com", password: "wrong" } }),
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid email or password.", statusCode: 401 }),
    );
  });

  it("returns a neutral forgot-password response", async () => {
    AuthService.sendPasswordReset.mockResolvedValue();
    const res = createResponse();
    const next = vi.fn();

    await forgotPassword(
      createRequest({ body: { email: " PERSON@EXAMPLE.COM " } }),
      res,
      next,
    );

    expect(AuthService.sendPasswordReset).toHaveBeenCalledWith(
      "person@example.com",
      "https://frontend.test/reset-password",
    );
    expect(res.json.mock.calls[0][0].message).toContain("If an account exists");
    expect(next).not.toHaveBeenCalled();
  });

  it("changes a password using the bearer token", async () => {
    AuthService.changePassword.mockResolvedValue({ id: "user-1" });
    const res = createResponse();
    const next = vi.fn();

    await resetPassword(
      createRequest({ body: { password: "new-password" }, authorization: "Bearer recovery-token" }),
      res,
      next,
    );

    expect(AuthService.changePassword).toHaveBeenCalledWith("recovery-token", "new-password");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns the authenticated user", async () => {
    const user = { id: "user-1", email: "person@example.com" };
    const res = createResponse();

    await getCurrentUser(createRequest({ user }), res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { user } });
  });

  it("globally signs out using the bearer token", async () => {
    AuthService.logout.mockResolvedValue();
    const res = createResponse();
    const next = vi.fn();

    await signOut(createRequest({ authorization: "Bearer access-token" }), res, next);

    expect(AuthService.logout).toHaveBeenCalledWith("access-token");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
