import supabase from "../config/supabase.js";
import { measureRequest } from "../utils/request-timing.js";

// Share overlapping checks only; settled results and failures are never cached.
const pendingVerifications = new Map();

const verifyAccessToken = (token) => {
  if (!pendingVerifications.has(token)) {
    const verification = supabase.auth.getUser(token).finally(() => {
      pendingVerifications.delete(token);
    });
    pendingVerifications.set(token, verification);
  }

  return pendingVerifications.get(token);
};

const authorize = async (req, res, next) => {
  try {
    const [scheme, token] = (req.headers.authorization || "").split(" ");

    if (scheme !== "Bearer" || !token) {
      const error = new Error("Not authorized to access this route");
      error.statusCode = 401;
      throw error;
    }

    const { data, error: authError } = await measureRequest("auth", () => verifyAccessToken(token));
    if (authError || !data.user) {
      const error = new Error("Invalid or expired access token");
      error.statusCode = 401;
      throw error;
    }

    req.user = data.user;
    req.accessToken = token;

    next();
  } catch (error) {
    next(error);
  }
};

export default authorize;
