import { describe, expect, it } from "vitest";
import { corsOptions, parseAllowedOrigins } from "../../config/cors.js";

const evaluateOrigin = (origin) =>
  new Promise((resolve) => {
    corsOptions.origin(origin, (error, allowed) => resolve({ error, allowed }));
  });

describe("CORS configuration", () => {
  it("parses, normalizes, and deduplicates trusted origins", () => {
    expect(
      parseAllowedOrigins("https://example.com, https://example.com/,http://localhost:5173"),
    ).toEqual(["https://example.com", "http://localhost:5173"]);
  });

  it.each([
    [undefined, "is required"],
    ["*", "cannot contain '*'"],
    ["ftp://example.com", "must use http or https"],
    ["https://example.com/path", "must not contain"],
    ["not-a-url", "Invalid CORS origin"],
  ])("rejects unsafe configuration: %s", (value, message) => {
    expect(() => parseAllowedOrigins(value)).toThrow(message);
  });

  it("allows a configured browser origin", async () => {
    const result = await evaluateOrigin("http://localhost:5173");
    expect(result).toEqual({ error: null, allowed: true });
  });

  it("allows requests without an Origin header", async () => {
    const result = await evaluateOrigin(undefined);
    expect(result).toEqual({ error: null, allowed: true });
  });

  it.each(["https://evil.example", "not-a-url", "http://localhost:5173/path"])(
    "rejects an untrusted or malformed request origin: %s",
    async (origin) => {
      const { error, allowed } = await evaluateOrigin(origin);
      expect(allowed).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(403);
    },
  );
});

