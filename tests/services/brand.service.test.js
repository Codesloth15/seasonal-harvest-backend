import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../model/brand.model.js", () => ({
  getAllBrands: vi.fn(),
  getBrandById: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
  countProductsByBrand: vi.fn(),
  deleteBrandWithProducts: vi.fn(),
}));

import * as BrandRepository from "../../model/brand.model.js";
import * as BrandService from "../../services/brand.service.js";

describe("brand service deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires confirmation when the brand has products", async () => {
    BrandRepository.getBrandById.mockResolvedValue({ id: "brand-1" });
    BrandRepository.countProductsByBrand.mockResolvedValue(3);

    await expect(BrandService.deleteBrand("brand-1", "token")).resolves.toEqual({
      requiresConfirmation: true,
      productCount: 3,
    });
    expect(BrandRepository.deleteBrandWithProducts).not.toHaveBeenCalled();
  });

  it("deletes the products and brand after confirmation", async () => {
    BrandRepository.getBrandById.mockResolvedValue({ id: "brand-1" });
    BrandRepository.countProductsByBrand.mockResolvedValue(3);
    BrandRepository.deleteBrandWithProducts.mockResolvedValue({
      brandDeleted: true,
      deletedProducts: 3,
    });

    await expect(BrandService.deleteBrand("brand-1", "token", true)).resolves.toEqual({
      requiresConfirmation: false,
      deletedProducts: 3,
    });
    expect(BrandRepository.deleteBrandWithProducts).toHaveBeenCalledWith("brand-1", "token");
  });

  it("deletes a brand without products immediately", async () => {
    BrandRepository.getBrandById.mockResolvedValue({ id: "brand-1" });
    BrandRepository.countProductsByBrand.mockResolvedValue(0);
    BrandRepository.deleteBrand.mockResolvedValue({ id: "brand-1" });

    await expect(BrandService.deleteBrand("brand-1", "token")).resolves.toEqual({
      requiresConfirmation: false,
      deletedProducts: 0,
    });
  });
});
