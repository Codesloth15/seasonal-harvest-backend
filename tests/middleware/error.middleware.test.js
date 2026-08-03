import { describe, expect, it, vi } from "vitest";
import errorMiddleware from "../../middleware/error.middleware.js";

const createResponse = () => {
  const response = {
    headersSent: false,
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
};

describe("error middleware product image errors", () => {
  it.each([
    ["LIMIT_FILE_SIZE", 413, "Product image must not exceed 5 MB."],
    ["LIMIT_FILE_COUNT", 400, "Only one product image may be uploaded."],
    [
      "LIMIT_UNEXPECTED_FILE",
      400,
      "Upload the product image using the multipart field named 'image'; only one image is allowed.",
    ],
    [
      "INVALID_PRODUCT_IMAGE_TYPE",
      400,
      "Unsupported product image type. Accepted formats: JPEG, PNG, WebP, and AVIF.",
    ],
  ])("maps %s to an actionable response", (code, status, message) => {
    const response = createResponse();

    errorMiddleware({ code, message: "generic" }, {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({ success: false, error: message, code });
  });

  it("preserves a detailed upstream storage error", () => {
    const response = createResponse();
    const error = {
      statusCode: 403,
      message: "new row violates row-level security policy for table objects",
    };

    errorMiddleware(error, {}, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: error.message,
    });
  });

  it("maps exhausted OpenAI quota to a stable service-unavailable response", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = createResponse();

    errorMiddleware(
      { code: "insufficient_quota", status: 429, message: "raw provider billing details" },
      {},
      response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: "The AI assistant is temporarily unavailable because its usage quota is exhausted.",
      code: "AI_UNAVAILABLE",
    });
  });
});
