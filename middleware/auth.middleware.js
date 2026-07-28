import supabase from "../config/supabase.js";

const authorize = async (req, res, next) => {
  try {
    const [scheme, token] = (req.headers.authorization || "").split(" ");

    if (scheme !== "Bearer" || !token) {
      const error = new Error("Not authorized to access this route");
      error.statusCode = 401;
      throw error;
    }

    const { data, error: authError } = await supabase.auth.getUser(token);
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
