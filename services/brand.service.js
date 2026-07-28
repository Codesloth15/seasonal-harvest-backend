import * as BrandRepository from "../model/brand.model.js";
import { notFound } from "../utils/http-error.js";

export const listBrands = (filters) => BrandRepository.getAllBrands(filters);

export const getBrand = async (id) => {
  const brand = await BrandRepository.getBrandById(id);
  if (!brand) throw notFound("Brand");
  return brand;
};

export const createBrand = (values, accessToken) => BrandRepository.createBrand(values, accessToken);

export const updateBrand = async (id, values, accessToken) => {
  const brand = await BrandRepository.updateBrand(id, values, accessToken);
  if (!brand) throw notFound("Brand");
  return brand;
};

export const deleteBrand = async (id, accessToken) => {
  const brand = await BrandRepository.deleteBrand(id, accessToken);
  if (!brand) throw notFound("Brand");
};
