import * as InventoryModel from "../model/inventory.model.js";

// Get all products with optional filters and sorting
export const getAllProducts = async (req, res, next) => {
  try {
    const { category, sort = 'created_at', order = 'desc' } = req.query;
    
    const filters = { sort, order };
    if (category) {
      filters.category = category;
    }
    
    const products = await InventoryModel.getAllInventory(filters);
    
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

// Get single product by ID
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await InventoryModel.getInventoryById(id);
    
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
    
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Create new product
export const createProduct = async (req, res, next) => {
  try {
    const { name, category, price, stock_qty, low_stock_threshold, description } = req.body;
    
    // Validate required fields
    if (!name || !category || price === undefined) {
      const error = new Error('Name, category, and price are required');
      error.statusCode = 400;
      throw error;
    }
    
    const productData = {
      name,
      category,
      price,
      stock_qty: stock_qty || 0,
      low_stock_threshold: low_stock_threshold || 10,
      description: description || null,
      created_by: req.user.id || req.user._id, // Support both Supabase and MongoDB user formats
    };
    
    const product = await InventoryModel.createInventory(productData);
    
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// Update product details
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, price, low_stock_threshold, description } = req.body;
    
    const product = await InventoryModel.getInventoryById(id);
    
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
    
    const updates = {};
    if (name) updates.name = name;
    if (category) updates.category = category;
    if (price !== undefined) updates.price = price;
    if (low_stock_threshold !== undefined) updates.low_stock_threshold = low_stock_threshold;
    if (description !== undefined) updates.description = description;
    
    const updatedProduct = await InventoryModel.updateInventory(id, updates);
    
    res.status(200).json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
};

// Adjust stock (add or subtract)
export const adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adjustment } = req.body;
    
    if (adjustment === undefined || typeof adjustment !== 'number') {
      const error = new Error('Adjustment value is required and must be a number');
      error.statusCode = 400;
      throw error;
    }
    
    const product = await InventoryModel.adjustStock(id, adjustment);
    
    res.status(200).json({ 
      success: true, 
      data: product,
      message: `Stock adjusted by ${adjustment > 0 ? '+' : ''}${adjustment}`
    });
  } catch (error) {
    next(error);
  }
};

// Soft delete product
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await InventoryModel.deleteInventory(id);
    
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get inventory summary report
export const getInventorySummary = async (req, res, next) => {
  try {
    const summary = await InventoryModel.getInventorySummary();
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};

// Get low stock items
export const getLowStockItems = async (req, res, next) => {
  try {
    const lowStockItems = await InventoryModel.getLowStockItems();
    
    res.status(200).json({
      success: true,
      data: lowStockItems,
      count: lowStockItems.length
    });
  } catch (error) {
    next(error);
  }
};
