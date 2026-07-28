import { createAuthenticatedSupabaseClient } from "../config/supabase.js";

const requireRole = (...allowedRoles) => {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole must be configured with at least one role.");
  }

  return async (req, res, next) => {
    try {
      if (!req.user || !req.accessToken) {
        const error = new Error("Authentication is required.");
        error.statusCode = 401;
        throw error;
      }

      const userClient = createAuthenticatedSupabaseClient(req.accessToken);
      const { data: profile, error: profileError } = await userClient
        .from("profiles")
        .select("role, is_active")
        .eq("id", req.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !profile.is_active) {
        const error = new Error("This account is inactive or has no application profile.");
        error.statusCode = 403;
        throw error;
      }

      if (!allowedRoles.includes(profile.role)) {
        const error = new Error("You do not have permission to perform this action.");
        error.statusCode = 403;
        throw error;
      }

      req.profile = profile;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default requireRole;

