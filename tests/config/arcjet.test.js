import { describe, expect, it, vi } from "vitest";

const { arcjet, botConfiguration, detectBot, shieldConfiguration, shield, slidingWindow } = vi.hoisted(() => {
  const botConfiguration = { value: null };
  const shieldConfiguration = { value: null };
  return {
    botConfiguration,
    shieldConfiguration,
    arcjet: vi.fn(() => ({ protect: vi.fn() })),
    detectBot: vi.fn((options) => {
      botConfiguration.value = options;
      return { type: "BOT", options };
    }),
    shield: vi.fn((options) => {
      shieldConfiguration.value = options;
      return { type: "SHIELD", options };
    }),
    slidingWindow: vi.fn((options) => ({ type: "RATE_LIMIT", options })),
  };
});

vi.mock("@arcjet/node", () => ({
  default: arcjet,
  detectBot,
  shield,
  slidingWindow,
}));

await import("../../config/arcjet.js");

describe("Arcjet configuration", () => {
  it("uses a supported non-blocking shield mode during development", () => {
    expect(shieldConfiguration.value).toEqual({ mode: "DRY_RUN" });
  });

  it("allows legitimate native and API development clients", () => {
    expect(botConfiguration.value).toEqual({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PROGRAMMATIC",
        "CATEGORY:TOOL",
        "UNKNOWN_BOT",
      ],
    });
  });
});
