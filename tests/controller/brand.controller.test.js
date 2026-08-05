import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/brand.service.js", () => ({
  listBrands: vi.fn(),
  getBrand: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
}));

import * as BrandService from "../../services/brand.service.js";
import { deleteBrand } from "../../controller/brand.controller.js";

const createResponse = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("brand controller deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the dialog payload when confirmation is required", async () => {
    BrandService.deleteBrand.mockResolvedValue({ requiresConfirmation: true, productCount: 2 });
    const res = createResponse();

    await deleteBrand(
      { params: { id: "brand-1" }, query: {}, accessToken: "token" },
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "BRAND_DELETE_CONFIRMATION_REQUIRED",
      data: { brandId: "brand-1", productCount: 2 },
    }));
  });

  it("passes confirmed deletion and reports the deleted product count", async () => {
    BrandService.deleteBrand.mockResolvedValue({ requiresConfirmation: false, deletedProducts: 2 });
    const res = createResponse();

    await deleteBrand(
      { params: { id: "brand-1" }, query: { confirm: "true" }, accessToken: "token" },
      res,
      vi.fn(),
    );

    expect(BrandService.deleteBrand).toHaveBeenCalledWith("brand-1", "token", true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ deletedProducts: 2 }));
  });
});
