import supabase from '../config/supabase.js';

// Table name
export const INVENTORY_TABLE = 'inventory';

// Create new inventory item
export const createInventory = async (data) => {
  const { data: result, error } = await supabase
    .from(INVENTORY_TABLE)
    .insert([data])
    .select();
  
  if (error) throw error;
  return result[0];
};

// Get all inventory items (with optional filters)
export const getAllInventory = async (filters = {}) => {
  let query = supabase.from(INVENTORY_TABLE).select('*');
  
  // Apply filters
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters.createdBy) {
    query = query.eq('created_by', filters.createdBy);
  }
  
  // Exclude soft-deleted items
  query = query.is('deleted_at', null);
  
  // Apply sorting
  const sortField = filters.sort || 'created_at';
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
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  
  if (error) throw error;
  return data;
};

// Update inventory item
export const updateInventory = async (id, updates) => {
  const { data, error } = await supabase
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
export const adjustStock = async (id, adjustment) => {
  // Get current stock
  const item = await getInventoryById(id);
  const newQty = item.stock_qty + adjustment;
  
  if (newQty < 0) {
    throw new Error('Stock cannot go below 0');
  }
  
  return updateInventory(id, { stock_qty: newQty });
};

// Soft delete inventory item
export const deleteInventory = async (id) => {
  const { data, error } = await supabase
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
export const getInventorySummary = async () => {
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .select('id, price, stock_qty, low_stock_threshold')
    .is('deleted_at', null);
  
  if (error) throw error;
  
  const totalValue = data.reduce((sum, item) => sum + (item.price * item.stock_qty), 0);
  const lowStockCount = data.filter(item => item.stock_qty <= item.low_stock_threshold).length;
  const totalItems = data.length;
  const totalQuantity = data.reduce((sum, item) => sum + item.stock_qty, 0);
  
  return {
    totalValue: totalValue.toFixed(2),
    lowStockCount,
    totalItems,
    totalQuantity,
    averagePrice: totalItems > 0 ? (totalValue / totalItems).toFixed(2) : 0
  };
};

// Get low stock items
export const getLowStockItems = async () => {
  const { data, error } = await supabase
    .from(INVENTORY_TABLE)
    .select('*')
    .is('deleted_at', null)
    .lte('stock_qty', supabase.rpc('low_stock_threshold'))
    .order('stock_qty', { ascending: true });
  
  if (error) {
    // Fallback if RPC doesn't work
    const allData = await supabase
      .from(INVENTORY_TABLE)
      .select('*')
      .is('deleted_at', null);
    
    if (allData.error) throw allData.error;
    
    return allData.data.filter(item => item.stock_qty <= item.low_stock_threshold)
      .sort((a, b) => a.stock_qty - b.stock_qty);
  }
  
  return data;
};

