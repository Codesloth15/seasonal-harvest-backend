import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "./env.js";

let client;

export const getAnthropicClient = () => {
  if (!ANTHROPIC_API_KEY) {
    const error = new Error("The AI assistant is not configured.");
    error.statusCode = 503;
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  client ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return client;
};
