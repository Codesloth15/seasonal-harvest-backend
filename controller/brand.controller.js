import * as BrandService from "../services/brand.service.js";
import { parseOptionalBoolean } from "../utils/validation.js";

export const getAllBrands = async (req, res, next) => {
  try {
    const brands = await BrandService.listBrands({
      search: req.query.search,
      active: parseOptionalBoolean(req.query.active, "active"),
      sort: req.query.sort,
      order: req.query.order,
    });
    res.status(200).json({ success: true, count: brands.length, data: brands });
  } catch (error) {
    next(error);
  }
};

export const getBrandById = async (req, res, next) => {
  try {
    const brand = await BrandService.getBrand(req.params.id);
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const createBrand = async (req, res, next) => {
  try {
    const brand = await BrandService.createBrand(req.body, req.accessToken);
    res.status(201).json({ success: true, message: "Brand created successfully.", data: brand });
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req, res, next) => {
  try {
    const brand = await BrandService.updateBrand(req.params.id, req.body, req.accessToken);
    res.status(200).json({ success: true, message: "Brand updated successfully.", data: brand });
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req, res, next) => {
  try {
    const confirmed = parseOptionalBoolean(req.query.confirm, "confirm") ?? false;
    const result = await BrandService.deleteBrand(req.params.id, req.accessToken, confirmed);

    if (result.requiresConfirmation) {
      return res.status(409).json({
        success: false,
        code: "BRAND_DELETE_CONFIRMATION_REQUIRED",
        error: `This brand has ${result.productCount} existing product(s). All of them will be deleted if you delete this brand.`,
        data: {
          brandId: req.params.id,
          productCount: result.productCount,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully.",
      deletedProducts: result.deletedProducts,
    });
  } catch (error) {
    next(error);
  }
};
