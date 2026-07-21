import supabase from "../config/supabase.js";
import { generateSku } from "../services/sku.service.js";

export const PRODUCT_TABLE = "products";

/**
 * Create Product
 */
export const createProduct = async (product) => {
  // 1. Fetch brand safely
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("name")
    .eq("id", product.brand_id)
    .maybeSingle(); // Returns null instead of throwing if 0 rows, handles single record cleanly

  if (brandError) throw brandError;
  if (!brand) throw new Error(`Brand with ID ${product.brand_id} not found.`);

  // 2. Generate SKU
  const sku = await generateSku(brand.name, product.name);

  // 3. Insert single object (pass an object {}, not an array [{}])
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .insert({
      category_id: product.category_id,
      brand_id: product.brand_id,
      name: product.name,
      description: product.description,
      product_type: product.product_type,
      sku: sku,
      barcode: product.barcode,
      unit: product.unit,
      price: product.price,
      image_url: product.image_url,
      is_active: product.is_active ?? true
    })
    .select()
    .single();

  if (error) throw error;

  return data;
};

/**
 * Get All Products
 */
export const getAllProducts = async (filters = {}) => {
  let query = supabase
    .from(PRODUCT_TABLE)
    .select("*");

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.brandId) {
    query = query.eq("brand_id", filters.brandId);
  }

  if (filters.productType) {
    query = query.eq("product_type", filters.productType);
  }

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  if (filters.active !== undefined) {
    query = query.eq("is_active", filters.active);
  }

  query = query.order(filters.sort || "created_at", {
    ascending: filters.order === "asc",
  });

  const { data, error } = await query;

  if (error) throw error;

  return data;
};

/**
 * Get Product By ID
 */
export const getProductById = async (id) => {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  return data;
};

/**
 * Update Product
 */
export const updateProduct = async (id, updates) => {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
};

/**
 * Soft Delete Product
 */
export const deleteProduct = async (id) => {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .update({
      is_active: false,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
};
