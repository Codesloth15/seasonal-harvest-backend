import { assistantTools, runAssistantTool } from "../ai/tools/assistant-tools.js";
import { ASSISTANT_INSTRUCTIONS } from "../ai/prompts/assistant.prompt.js";
import { OPENAI_MODEL } from "../config/env.js";
import { getOpenAIClient } from "../config/openai.js";

const DEFAULT_MODEL = "gpt-5.6-sol";
const MAX_TOOL_ROUNDS = 5;

export const askAssistant = async (message) => {
  const openai = getOpenAIClient();
  const request = {
    model: OPENAI_MODEL || DEFAULT_MODEL,
    instructions: ASSISTANT_INSTRUCTIONS,
    input: message,
    tools: assistantTools,
    max_output_tokens: 800,
  };

  let response = await openai.responses.create(request);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = response.output.filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      return { answer: response.output_text, responseId: response.id };
    }

    const outputs = await Promise.all(
      calls.map(async (call) => ({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(await runAssistantTool(call.name, call.arguments)),
      })),
    );

    response = await openai.responses.create({
      ...request,
      input: outputs,
      previous_response_id: response.id,
    });
  }

  const error = new Error("The AI assistant exceeded its tool-call limit.");
  error.statusCode = 502;
  error.code = "AI_TOOL_LIMIT";
  throw error;
};
