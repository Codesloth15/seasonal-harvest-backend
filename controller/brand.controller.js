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
    await BrandService.deleteBrand(req.params.id, req.accessToken);
    res.status(200).json({ success: true, message: "Brand deleted successfully." });
  } catch (error) {
    next(error);
  }
};
