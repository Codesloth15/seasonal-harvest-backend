import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "./env.js";

let client;

export const getGeminiClient = () => {
  if (!GEMINI_API_KEY) {
    const error = new Error("The AI assistant is not configured.");
    error.statusCode = 503;
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return client;
};
