import { assistantTools, runAssistantTool } from "../ai/tools/assistant-tools.js";
import { ASSISTANT_INSTRUCTIONS } from "../ai/prompts/assistant.prompt.js";
import { GEMINI_MODEL } from "../config/env.js";
import { getGeminiClient } from "../config/gemini.js";
import { logAiAuditEvent } from "../utils/ai-audit.js";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_TOOL_ROUNDS = 5;

const functionDeclarations = assistantTools.map(({ name, description, parameters }) => ({
  name, description, parameters,
}));

const providerRequest = (contents) => ({
  model: GEMINI_MODEL || DEFAULT_MODEL,
  contents,
  config: {
    systemInstruction: ASSISTANT_INSTRUCTIONS,
    tools: [{ functionDeclarations }],
    maxOutputTokens: 800,
    temperature: 0.2,
  },
});

const generateContent = async (gemini, contents) => {
  try {
    return await gemini.models.generateContent(providerRequest(contents));
  } catch (error) {
    error.isAiProviderError = true;
    throw error;
  }
};

const formatLowStockAnswer = (toolResult) => {
  if (!toolResult.items?.length) return "No low-stock products found.";
  return toolResult.items
    .map((item) => `${item.name}: ${item.displayQuantity} ${item.displayUnit}`)
    .join("\n");
};

export const askAssistant = async (message, actor = {}) => {
  const startedAt = Date.now();
  logAiAuditEvent("request_started", { ...actor, messageLength: message.length });

  try {
    const gemini = getGeminiClient();
    const contents = [{ role: "user", parts: [{ text: message }] }];
    let response = await generateContent(gemini, contents);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      const responseId = response.responseId || null;
      const result = { answer: response.text || "No answer was generated.", responseId };
      logAiAuditEvent("request_succeeded", {
        ...actor,
        messageLength: message.length,
        durationMs: Date.now() - startedAt,
        responseId,
      });
      return result;
    }

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);
    const executedCalls = await Promise.all(calls.map(async (call) => ({
      call,
      result: await runAssistantTool(call.name, call.args, { accessToken: actor.accessToken }),
    })));
    const lowStockCall = executedCalls.find(({ call }) => call.name === "get_low_stock_items");
    if (lowStockCall) {
      const responseId = response.responseId || null;
      const result = { answer: formatLowStockAnswer(lowStockCall.result), responseId };
      logAiAuditEvent("request_succeeded", {
        ...actor,
        messageLength: message.length,
        durationMs: Date.now() - startedAt,
        responseId,
      });
      return result;
    }

    const outputs = executedCalls.map(({ call, result }) => ({
      functionResponse: { name: call.name, response: { result } },
    }));
    contents.push({ role: "user", parts: outputs });
    response = await generateContent(gemini, contents);
  }

    const error = new Error("The AI assistant exceeded its tool-call limit.");
    error.statusCode = 502;
    error.code = "AI_TOOL_LIMIT";
    throw error;
  } catch (error) {
    logAiAuditEvent("request_failed", {
      ...actor,
      messageLength: message.length,
      durationMs: Date.now() - startedAt,
      errorCode: error.code || "AI_REQUEST_FAILED",
    });
    throw error;
  }
};
