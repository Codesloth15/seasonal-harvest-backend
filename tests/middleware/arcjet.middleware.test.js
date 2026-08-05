import { beforeEach, describe, expect, it, vi } from "vitest";

const protect = vi.fn();
const productProtect = vi.fn();

vi.mock("../../config/arcjet.js", () => ({
  aj: { protect },
  productReadAj: { protect: productProtect },
}));

const { default: arcjetMiddleware, productReadArcjetMiddleware } = await import(
  "../../middleware/arcjet.middleware.js"
);

const allowedDecision = () => ({ isDenied: () => false });
const deniedDecision = (reason) => ({
  isDenied: () => true,
  reason: {
    isRateLimit: () => reason === "rate-limit",
    isBot: () => reason === "bot",
  },
});

const createResponse = () => {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
};

describe("arcjetMiddleware", () => {
  beforeEach(() => {
    protect.mockReset();
    productProtect.mockReset();
  });

  it("checks an allowed request and continues", async () => {
    const request = { method: "GET", url: "/api/v1/categories" };
    const next = vi.fn();
    protect.mockResolvedValue(allowedDecision());

    await arcjetMiddleware(request, createResponse(), next);

    expect(protect).toHaveBeenCalledWith(request);
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 429 for rate-limited requests", async () => {
    const response = createResponse();
    const next = vi.fn();
    protect.mockResolvedValue(deniedDecision("rate-limit"));

    await arcjetMiddleware({}, response, next);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      error: "Too many requests. Please try again later.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for detected bots", async () => {
    const response = createResponse();
    protect.mockResolvedValue(deniedDecision("bot"));

    await arcjetMiddleware({}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Bot access is restricted." });
  });

  it("returns 403 for shield denials", async () => {
    const response = createResponse();
    protect.mockResolvedValue(deniedDecision("shield"));

    await arcjetMiddleware({}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Access denied by security policy." });
  });

  it("uses the dedicated Arcjet client for product reads", async () => {
    const request = { method: "GET", url: "/api/v1/products" };
    const next = vi.fn();
    productProtect.mockResolvedValue(allowedDecision());

    await productReadArcjetMiddleware(request, createResponse(), next);

    expect(productProtect).toHaveBeenCalledWith(request);
    expect(next).toHaveBeenCalledOnce();
  });
});
