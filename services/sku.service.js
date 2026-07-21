import supabase from "../config/supabase.js";

export const generateSku = async (brandName, productName) => {

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

  // Find existing SKU count
  const { data, error } = await supabase
    .from("products")
    .select("sku")
    .like("sku", `${prefix}%`);

  if (error) throw error;

  const number = String(data.length + 1).padStart(3, "0");

  return `${prefix}-${number}`;
};