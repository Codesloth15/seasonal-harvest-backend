import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";
import { ARCJET_KEY } from "./env.js";

export const aj = arcjet({
  key: ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE"],
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
