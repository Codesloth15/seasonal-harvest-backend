import { FRONTEND_URL } from "../config/env.js";
import * as AuthService from "../services/auth.service.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const validateEmail = (email) => {
  if (!emailPattern.test(email)) {
    throw createHttpError("A valid email address is required.");
  }
};

const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < 8) {
    throw createHttpError("Password must be at least 8 characters long.");
  }
};

const getAccessToken = (req) => {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  return scheme === "Bearer" ? token : null;
};

const mapAuthError = (error) => {
  if (error.statusCode) return error;

  const message = String(error.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) {
    return createHttpError("Invalid email or password.", 401);
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return createHttpError("An account with this email already exists.", 409);
  }
  if (message.includes("rate limit")) {
    return createHttpError("Too many authentication attempts. Please try again later.", 429);
  }

  error.statusCode = Number(error.status) || 400;
  return error;
};

export const signUp = async (req, res, next) => {
  try {
    const fullName = String(req.body.fullName || req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (fullName.length < 2 || fullName.length > 100) {
      throw createHttpError("Full name must be between 2 and 100 characters.");
    }
    validateEmail(email);
    validatePassword(password);

    const data = await AuthService.register({ fullName, email, password });

    res.status(201).json({
      success: true,
      message: data.session
        ? "Account created successfully."
        : "Account created. Check your email to verify your account.",
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    next(mapAuthError(error));
  }
};

export const signIn = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    validateEmail(email);
    if (typeof password !== "string" || !password) {
      throw createHttpError("Password is required.");
    }

    const data = await AuthService.login({ email, password });

    res.status(200).json({
      success: true,
      message: "Signed in successfully.",
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    next(mapAuthError(error));
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    validateEmail(email);

    const redirectTo = FRONTEND_URL
      ? `${FRONTEND_URL.replace(/\/$/, "")}/reset-password`
      : undefined;

    await AuthService.sendPasswordReset(email, redirectTo);

    res.status(200).json({
      success: true,
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    next(mapAuthError(error));
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    validatePassword(password);

    const user = await AuthService.changePassword(getAccessToken(req), password);

    res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      data: { user },
    });
  } catch (error) {
    next(mapAuthError(error));
  }
};

export const getCurrentUser = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
};

export const signOut = async (req, res, next) => {
  try {
    await AuthService.logout(getAccessToken(req));

    res.status(200).json({
      success: true,
      message: "Signed out successfully.",
    });
  } catch (error) {
    next(mapAuthError(error));
  }
};
