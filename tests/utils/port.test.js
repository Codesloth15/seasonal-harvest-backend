import { describe, expect, it } from "vitest";
import { parsePort } from "../../utils/port.js";

describe("port configuration", () => {
  it.each([
    ["3000", 3000],
    ["5500", 5500],
    ["65535", 65535],
  ])("accepts valid port %s", (value, expected) => {
    expect(parsePort(value)).toBe(expected);
  });

  it.each([undefined, "", "0", "65536", "abc", "3000.5"])(
    "rejects invalid port %s",
    (value) => {
      expect(() => parsePort(value)).toThrow("PORT must be an integer between 1 and 65535.");
    },
  );
});

