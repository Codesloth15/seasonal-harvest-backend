import * as BrandModel from "../model/brand.model.js";

export const getAllBrands = async (req, res, next) => {
  try {
    const { search, active, sort, order } = req.query;
    const filters = { search, sort, order };

    if (active !== undefined) {
      if (active !== "true" && active !== "false") {
        return res.status(400).json({ success: false, error: "active must be true or false." });
      }
      filters.active = active === "true";
    }

    const brands = await BrandModel.getAllBrands(filters);

    res.status(200).json({
      success: true,
      count: brands.length,
      data: brands,
    });
  } catch (error) {
    next(error);
  }
};


export const getBrandById = async (req, res, next) => {
  try {
    const brand = await BrandModel.getBrandById(req.params.id);
    if (!brand) return res.status(404).json({ success: false, error: "Brand not found." });

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

export const createBrand = async (req, res, next) => {
  try {
    const brand = await BrandModel.createBrand(req.body);

    res.status(201).json({
      success: true,
      message: "Brand created successfully.",
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req, res, next) => {
  try {
    const brand = await BrandModel.updateBrand(req.params.id, req.body);
    if (!brand) return res.status(404).json({ success: false, error: "Brand not found." });

    res.status(200).json({
      success: true,
      message: "Brand updated successfully.",
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req, res, next) => {
  try {
    const brand = await BrandModel.deleteBrand(req.params.id);
    if (!brand) return res.status(404).json({ success: false, error: "Brand not found." });

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
