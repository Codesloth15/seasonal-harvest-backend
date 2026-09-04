import { assistantTools, runAssistantTool } from "../ai/tools/assistant-tools.js";
import { ASSISTANT_INSTRUCTIONS } from "../ai/prompts/assistant.prompt.js";
import { ANTHROPIC_MODEL } from "../config/env.js";
import { getAnthropicClient } from "../config/anthropic.js";
import { logAiAuditEvent } from "../utils/ai-audit.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ROUNDS = 5;

const tools = assistantTools.map(({ name, description, parameters }) => ({
  name, description, parameters,
}));

const providerRequest = (messages) => ({
  model: ANTHROPIC_MODEL || DEFAULT_MODEL,
  system: ASSISTANT_INSTRUCTIONS,
  messages,
  tools: tools.map(({ name, description, parameters }) => ({
    name,
    description,
    input_schema: parameters,
  })),
  max_tokens: 800,
  temperature: 0.2,
});

const createMessage = async (anthropic, messages) => {
  try {
    return await anthropic.messages.create(providerRequest(messages));
  } catch (error) {
    error.isAiProviderError = true;
    throw error;
  }
};

const responseText = (response) => response.content
  .filter((block) => block.type === "text")
  .map((block) => block.text)
  .join("\n")
  .trim();

const formatLowStockAnswer = (toolResult) => {
  if (!toolResult.items?.length) return "No low-stock products found.";
  return toolResult.items
    .map((item) => `${item.name}: ${item.displayQuantity} ${item.displayUnit}`)
    .join("\n");
};

export const askAssistant = async (message, actor = {}, history = []) => {
  const startedAt = Date.now();
  logAiAuditEvent("request_started", { ...actor, messageLength: message.length });

  try {
    const anthropic = getAnthropicClient();
    const messages = [...history, { role: "user", content: message }];
    let response = await createMessage(anthropic, messages);

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const calls = response.content.filter((block) => block.type === "tool_use");
      if (calls.length === 0) {
        const responseId = response.id || null;
        const result = {
          answer: responseText(response) || "No answer was generated.",
          responseId,
        };
        logAiAuditEvent("request_succeeded", {
          ...actor,
          messageLength: message.length,
          durationMs: Date.now() - startedAt,
          responseId,
        });
        return result;
      }

      messages.push({ role: "assistant", content: response.content });
      const executedCalls = await Promise.all(calls.map(async (call) => ({
        call,
        result: await runAssistantTool(
          call.name,
          call.input,
          { accessToken: actor.accessToken },
        ),
      })));
      const lowStockCall = executedCalls.find(
        ({ call }) => call.name === "get_low_stock_items",
      );
      if (lowStockCall) {
        const responseId = response.id || null;
        const result = {
          answer: formatLowStockAnswer(lowStockCall.result),
          responseId,
        };
        logAiAuditEvent("request_succeeded", {
          ...actor,
          messageLength: message.length,
          durationMs: Date.now() - startedAt,
          responseId,
        });
        return result;
      }

      messages.push({
        role: "user",
        content: executedCalls.map(({ call, result }) => ({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
        })),
      });
      response = await createMessage(anthropic, messages);
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
