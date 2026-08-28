import supabase, { createAuthenticatedSupabaseClient } from "../config/supabase.js";
import { generateSku } from "../services/sku.service.js";

export const PRODUCT_TABLE = "products";
export const PRODUCT_CURRENCY = "PHP";
export const PRODUCT_SELECT = "*, brand:brands(id, name, logo_url, is_active)";

const PRODUCT_FIELDS = new Set([
  "category_id",
  "brand_id",
  "name",
  "description",
  "product_type",
  "barcode",
  "unit",
  "package_unit",
  "units_per_package",
  "price",
  "image_url",
  "is_active",
]);

const pickProductFields = (values) =>
  Object.fromEntries(
    Object.entries(values).filter(([key, value]) =>
      PRODUCT_FIELDS.has(key) && value !== undefined
    )
  );

const validatePrice = (values) => {
  if (values.price === undefined) return;

  const price = Number(values.price);
  if (!Number.isFinite(price) || price < 0) {
    const error = new Error("price must be a non-negative amount in Philippine pesos.");
    error.statusCode = 400;
    throw error;
  }

  values.price = price;
};

const INVENTORY_UNITS = new Set([
  "BOX", "PACK", "BALE", "PIECE", "SACK", "CRATE", "TRAY", "BUNDLE",
  "KILOGRAM", "GRAM", "LITER", "MILLILITER",
]);

const normalizeUnit = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : value;

const validatePackaging = (values, { creating = false } = {}) => {
  const hasPackageUnit = values.package_unit !== undefined;
  const hasUnitsPerPackage = values.units_per_package !== undefined;

  if (values.unit !== undefined) {
    values.unit = normalizeUnit(values.unit);
    if (!INVENTORY_UNITS.has(values.unit)) {
      const error = new Error("unit must be a supported inventory unit.");
      error.statusCode = 400;
      throw error;
    }
  }

  if (!hasPackageUnit && !hasUnitsPerPackage) return;
  if (!hasPackageUnit || !hasUnitsPerPackage) {
    const error = new Error("package_unit and units_per_package must be provided together.");
    error.statusCode = 400;
    throw error;
  }

  values.package_unit = normalizeUnit(values.package_unit);
  values.units_per_package = Number(values.units_per_package);
  if (!INVENTORY_UNITS.has(values.package_unit)) {
    const error = new Error("package_unit must be a supported inventory unit.");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(values.units_per_package) || values.units_per_package <= 1) {
    const error = new Error("units_per_package must be a number greater than 1.");
    error.statusCode = 400;
    throw error;
  }

  const baseUnit = values.unit ?? (creating ? "PIECE" : undefined);
  if (baseUnit === values.package_unit) {
    const error = new Error("package_unit must differ from unit.");
    error.statusCode = 400;
    throw error;
  }
  if (creating && values.unit === undefined) values.unit = baseUnit;
};

const withCurrency = (product) =>
  product ? { ...product, currency: PRODUCT_CURRENCY } : null;

/**
 * Create Product
 */
export const createProduct = async (product, accessToken) => {
  const values = pickProductFields(product);
  validatePrice(values);
  validatePackaging(values, { creating: true });
  if (!values.name || !values.category_id || !values.product_type || values.price === undefined) {
    const error = new Error("name, category_id, product_type, and price are required.");
    error.statusCode = 400;
    throw error;
  }
  if (!["BRANDED", "UNBRANDED"].includes(values.product_type)) {
    const error = new Error("product_type must be BRANDED or UNBRANDED.");
    error.statusCode = 400;
    throw error;
  }
  const isBranded = values.product_type === "BRANDED";
  let brandName = "UNBRANDED";

  if (isBranded && !values.brand_id) {
    const error = new Error("brand_id is required for BRANDED products.");
    error.statusCode = 400;
    throw error;
  }

  if (!isBranded && values.brand_id) {
    const error = new Error("brand_id must not be provided for UNBRANDED products.");
    error.statusCode = 400;
    throw error;
  }

  if (values.brand_id) {
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("name")
      .eq("id", values.brand_id)
      .eq("is_active", true)
      .maybeSingle();

    if (brandError) throw brandError;
    if (!brand) {
      const error = new Error(`Active brand with ID ${values.brand_id} not found.`);
      error.statusCode = 400;
      throw error;
    }

    brandName = brand.name;
  }

  const sku = await generateSku(brandName, values.name);

  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(PRODUCT_TABLE)
    .insert({
      ...values,
      sku: sku,
      is_active: values.is_active ?? true,
    })
    .select(PRODUCT_SELECT)
    .single();

  if (error) throw error;

  return withCurrency(data);
};

/**
 * Get All Products
 */
export const getAllProducts = async (filters = {}) => {
  let query = supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT);

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

  const sortColumns = new Set(["name", "price", "created_at", "updated_at"]);
  const sort = sortColumns.has(filters.sort) ? filters.sort : "created_at";
  query = query.order(sort, {
    ascending: filters.order === "asc",
  });

  const { data, error } = await query;

  if (error) throw error;

  return data.map(withCurrency);
};

/**
 * Get Product By ID
 */
export const getProductById = async (id) => {
  const { data, error } = await supabase
    .from(PRODUCT_TABLE)
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return withCurrency(data);
};

/**
 * Update Product
 */
export const updateProduct = async (id, updates, accessToken) => {
  const values = pickProductFields(updates);
  if (Object.keys(values).length === 0) {
    const error = new Error("Provide at least one valid product field to update.");
    error.statusCode = 400;
    throw error;
  }
  validatePrice(values);
  validatePackaging(values);

  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(PRODUCT_TABLE)
    .update(values)
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .maybeSingle();

  if (error) throw error;

  return withCurrency(data);
};

/**
 * Permanently Delete Product
 */
export const deleteProduct = async (id, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(PRODUCT_TABLE)
    .delete()
    .eq("id", id)
    .select(PRODUCT_SELECT)
    .maybeSingle();

  if (error) throw error;

  return withCurrency(data);
};
