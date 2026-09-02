import supabase from "../config/supabase.js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config/env.js";

const authRequest = async (path, options = {}) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || "Authentication request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
};

const authenticatedRequest = (path, accessToken, options = {}) => authRequest(path, {
  ...options,
  headers: {
    Authorization: `Bearer ${accessToken}`,
    ...options.headers,
  },
});

export const register = async ({ fullName, email, password }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
};

export const login = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const refreshSession = async (refreshToken) => {
  return authRequest("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
};

export const sendPasswordReset = async (email, redirectTo) => {
  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, options);

  if (error) throw error;
};

export const changePassword = async (accessToken, password) => {
  return authenticatedRequest("/user", accessToken, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
};

export const logout = async (accessToken) => {
  await authenticatedRequest("/logout?scope=global", accessToken, {
    method: "POST",
  });
};
