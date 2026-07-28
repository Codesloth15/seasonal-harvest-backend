import supabase from "../config/supabase.js";

export const BRAND_TABLE = "brands";

const BRAND_FIELDS = new Set(["name", "logo_url", "is_active"]);

const pickBrandFields = (values) =>
  Object.fromEntries(
    Object.entries(values).filter(([key, value]) =>
      BRAND_FIELDS.has(key) && value !== undefined
    )
  );

export const getAllBrands = async (filters = {}) => {
  let query = supabase
    .from(BRAND_TABLE)
    .select("*");

  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.active !== undefined) query = query.eq("is_active", filters.active);

  const sortColumns = new Set(["name", "created_at", "updated_at"]);
  const sort = sortColumns.has(filters.sort) ? filters.sort : "name";
  query = query.order(sort, { ascending: filters.order !== "desc" });

  const { data, error } = await query;

  if (error) throw error;

  return data;
};

export const getBrandById = async (id) => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
};

export const createBrand = async (brand) => {
  const values = pickBrandFields(brand);
  if (!values.name || !values.name.trim()) {
    const error = new Error("name is required to create a brand.");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .insert({ ...values, name: values.name.trim(), is_active: brand.is_active ?? true })
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const updateBrand = async (id, updates) => {
  const values = pickBrandFields(updates);
  if (Object.keys(values).length === 0) {
    const error = new Error("Provide at least one valid brand field to update.");
    error.statusCode = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
};

export const deleteBrand = async (id) => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
};
