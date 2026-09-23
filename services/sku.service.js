import { createAuthenticatedSupabaseClient } from "../config/supabase.js";

export const generateSku = async (brandName, productName, accessToken) => {

  // Create brand code
  const brandCode = brandName
    .replace(/[^A-Za-z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase();

  // Create product code
  const productCode = productName
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .split(" ")[0]
    .substring(0, 8)
    .toUpperCase();

  const prefix = `${brandCode}-${productCode}`;

  const { data, error } = await createAuthenticatedSupabaseClient(accessToken)
    .rpc("allocate_product_sku", { p_prefix: prefix });

  if (error) throw error;

  return data;
};
