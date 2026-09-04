import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";
import { ARCJET_KEY } from "./env.js";

export const aj = arcjet({
  key: ARCJET_KEY,
  rules: [
    shield({ mode: "DRY_RUN" }),
    detectBot({
      mode: "LIVE",
      // This API is consumed by Expo/React Native, which Arcjet can classify as
      // programmatic or unknown traffic even when the request is legitimate.
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PROGRAMMATIC",
        "CATEGORY:TOOL",
        "UNKNOWN_BOT",
      ],
    }),
  ],
});

// Catalog browsing is intentionally more generous than sensitive API actions.
export const productReadAj = arcjet({
  key: ARCJET_KEY,
  rules: [
    slidingWindow({
      mode: "LIVE",
      interval: 60,
      max: 120,
      characteristics: ["ip.src"],
    }),
  ],
});
