import supabase, { createAuthenticatedSupabaseClient } from "../config/supabase.js";

export const CATEGORY_TABLE = "categories";

const CATEGORY_FIELDS = new Set(["name", "description", "icon"]);

const pickCategoryFields = (values) =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => CATEGORY_FIELDS.has(key) && value !== undefined,
    ),
  );

const normalizeCategoryValues = (input, { requireName = false } = {}) => {
  const values = pickCategoryFields(input);

  if (values.name !== undefined) {
    if (typeof values.name !== "string" || !values.name.trim()) {
      const error = new Error("Category name must be a non-empty string.");
      error.statusCode = 400;
      throw error;
    }
    values.name = values.name.trim();
  }

  if (requireName && !values.name) {
    const error = new Error("Category name is required.");
    error.statusCode = 400;
    throw error;
  }

  for (const field of ["description", "icon"]) {
    if (values[field] !== undefined && values[field] !== null) {
      if (typeof values[field] !== "string") {
        const error = new Error(`Category ${field} must be a string or null.`);
        error.statusCode = 400;
        throw error;
      }
      values[field] = values[field].trim() || null;
    }
  }

  return values;
};

export const getAllCategories = async (filters = {}) => {
  let query = supabase.from(CATEGORY_TABLE).select("*");

  if (filters.search) query = query.ilike("name", `%${filters.search}%`);

  const sortColumns = new Set(["name", "created_at", "updated_at"]);
  const sort = sortColumns.has(filters.sort) ? filters.sort : "name";
  query = query.order(sort, { ascending: filters.order !== "desc" });

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getCategoryById = async (id) => {
  const { data, error } = await supabase
    .from(CATEGORY_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const createCategory = async (category, accessToken) => {
  const values = normalizeCategoryValues(category, { requireName: true });
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(CATEGORY_TABLE)
    .insert(values)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCategory = async (id, updates, accessToken) => {
  const values = normalizeCategoryValues(updates);
  if (Object.keys(values).length === 0) {
    const error = new Error("Provide at least one valid category field to update.");
    error.statusCode = 400;
    throw error;
  }

  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(CATEGORY_TABLE)
    .update(values)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const deleteCategory = async (id, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(CATEGORY_TABLE)
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
};

