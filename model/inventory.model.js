import supabase, { createAuthenticatedSupabaseClient } from '../config/supabase.js';

// Table name
export const INVENTORY_TABLE = 'inventory';

export const INVENTORY_PRODUCT_SELECT = `
  id,
  name,
  sku,
  unit,
  price,
  image_url,
  is_active,
  product_type,
  brand_id,
  brand:brands(id, name, logo_url, is_active)
`;

// Create new inventory item
export const createInventory = async (data, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data: result, error } = await userClient
    .from(INVENTORY_TABLE)
    .insert([data])
    .select();
  
  if (error) throw error;
  return result[0];
};

// Get all inventory items (with optional filters)
export const getAllInventory = async (filters = {}, accessToken) => {
  const client = accessToken ? createAuthenticatedSupabaseClient(accessToken) : supabase;
  let query = client
    .from(INVENTORY_TABLE)
    .select(`*, product:products(${INVENTORY_PRODUCT_SELECT})`);
  
  // Apply sorting
  const allowedSortFields = new Set([
    'created_at', 'updated_at', 'quantity_on_hand', 'reserved_quantity',
    'low_stock_threshold', 'last_received_at',
  ]);
  const sortField = allowedSortFields.has(filters.sort) ? filters.sort : 'created_at';
  const sortOrder = filters.order === 'asc' ? { ascending: true } : { ascending: false };
  query = query.order(sortField, sortOrder);
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data;
};

// Get single inventory item by ID
export const getInventoryById = async (id) => {
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .select(`*, product:products(${INVENTORY_PRODUCT_SELECT})`)
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

// Update inventory item
export const updateInventory = async (id, updates, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(INVENTORY_TABLE)
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Adjust stock (add or subtract)
export const adjustStock = async (id, adjustment, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient.rpc('adjust_inventory_stock', {
    p_inventory_id: id,
    p_operation: adjustment.operation,
    p_quantity: adjustment.quantity,
    p_unit: adjustment.unit ?? null,
    p_transaction_type: adjustment.transaction_type,
    p_reason: adjustment.reason,
    p_performed_by: adjustment.performed_by,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
};

export const updateInventoryPackaging = async (id, packaging, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(INVENTORY_TABLE)
    .update(packaging)
    .eq('id', id)
    .select(`*, product:products(${INVENTORY_PRODUCT_SELECT})`)
    .single();

  if (error) throw error;
  return data;
};

// Soft delete inventory item
export const deleteInventory = async (id, accessToken) => {
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await userClient
    .from(INVENTORY_TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Get inventory summary
export const getInventorySummary = async (accessToken) => {
  const client = accessToken ? createAuthenticatedSupabaseClient(accessToken) : supabase;
  const { data, error } = await client
    .from(INVENTORY_TABLE)
    .select('id, quantity_on_hand, available_quantity, low_stock_threshold, product:products(price)');
  
  if (error) throw error;
  
  const totalValue = data.reduce(
    (sum, item) => sum + (Number(item.product?.price || 0) * Number(item.quantity_on_hand)),
    0,
  );
  const lowStockCount = data.filter(
    (item) => Number(item.available_quantity) <= Number(item.low_stock_threshold),
  ).length;
  const totalItems = data.length;
  const totalQuantity = data.reduce((sum, item) => sum + Number(item.quantity_on_hand), 0);
  
  return {
    totalValue: totalValue.toFixed(2),
    lowStockCount,
    totalItems,
    totalQuantity,
    averagePrice: totalItems > 0 ? (totalValue / totalItems).toFixed(2) : 0
  };
};

// Get low stock items
export const getLowStockItems = async (accessToken) => {
  const client = accessToken ? createAuthenticatedSupabaseClient(accessToken) : supabase;
  const { data, error } = await client
    .from(INVENTORY_TABLE)
    .select(`*, product:products(${INVENTORY_PRODUCT_SELECT})`);

  if (error) throw error;
  
  return data
    .filter((item) => Number(item.available_quantity) <= Number(item.low_stock_threshold))
    .sort((a, b) => Number(a.available_quantity) - Number(b.available_quantity));
};

// Get immutable adjustment history for one inventory item
export const getInventoryTransactions = async (inventoryId, filters = {}, accessToken) => {
  const client = createAuthenticatedSupabaseClient(accessToken);
  const page = filters.page;
  const limit = filters.limit;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = client
    .from('inventory_transactions')
    .select(
      `*, product:products(${INVENTORY_PRODUCT_SELECT})`,
      { count: 'exact' },
    )
    .eq('inventory_id', inventoryId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.operation) query = query.eq('operation', filters.operation);

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count ?? 0;
  return {
    items: data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
};

