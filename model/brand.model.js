import supabase from "../config/supabase.js";

export const BRAND_TABLE = "brands";

export const getAllBrands = async () => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;

  return data;
};

export const getBrandById = async (id) => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
};

export const createBrand = async (brand) => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .insert([brand])
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const updateBrand = async (id, updates) => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const deleteBrand = async (id) => {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;

  return data;
};