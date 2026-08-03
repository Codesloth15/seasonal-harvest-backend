import OpenAI from "openai";
import { OPENAI_API_KEY } from "./env.js";

let client;

export const getOpenAIClient = () => {
  if (!OPENAI_API_KEY) {
    const error = new Error("The AI assistant is not configured.");
    error.statusCode = 503;
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  client ??= new OpenAI({ apiKey: OPENAI_API_KEY });
  return client;
};
