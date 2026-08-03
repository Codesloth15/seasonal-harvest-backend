import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const runAssistantTool = vi.fn();
const logAiAuditEvent = vi.fn();

vi.mock("../../config/openai.js", () => ({
  getOpenAIClient: () => ({ responses: { create } }),
}));
vi.mock("../../ai/tools/assistant-tools.js", () => ({
  assistantTools: [{ type: "function", name: "test_tool" }],
  runAssistantTool,
}));
vi.mock("../../utils/ai-audit.js", () => ({ logAiAuditEvent }));

const { askAssistant } = await import("../../services/assistant.service.js");

describe("assistant service", () => {
  beforeEach(() => {
    create.mockReset();
    runAssistantTool.mockReset();
    logAiAuditEvent.mockReset();
  });

  it("returns a direct answer and writes safe lifecycle audit events", async () => {
    create.mockResolvedValue({ id: "resp-1", output: [], output_text: "Current stock is 10." });

    const result = await askAssistant("What is the stock?", {
      userId: "admin-1",
      role: "admin",
    });

    expect(result).toEqual({ answer: "Current stock is 10.", responseId: "resp-1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "What is the stock?",
        tools: [{ type: "function", name: "test_tool" }],
        max_output_tokens: 800,
      }),
    );
    expect(logAiAuditEvent).toHaveBeenNthCalledWith(
      1,
      "request_started",
      expect.objectContaining({ userId: "admin-1", messageLength: 18 }),
    );
    expect(logAiAuditEvent).toHaveBeenNthCalledWith(
      2,
      "request_succeeded",
      expect.objectContaining({ responseId: "resp-1" }),
    );
  });

  it("executes function calls and returns their output to the previous response", async () => {
    create
      .mockResolvedValueOnce({
        id: "resp-tools",
        output: [{ type: "function_call", name: "test_tool", call_id: "call-1", arguments: "{}" }],
      })
      .mockResolvedValueOnce({ id: "resp-final", output: [], output_text: "Tool-backed answer." });
    runAssistantTool.mockResolvedValue({ count: 2 });

    await askAssistant("Use a tool");

    expect(runAssistantTool).toHaveBeenCalledWith("test_tool", "{}");
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        previous_response_id: "resp-tools",
        input: [{ type: "function_call_output", call_id: "call-1", output: '{"count":2}' }],
      }),
    );
  });

  it("audits provider failures and preserves the original error", async () => {
    const providerError = Object.assign(new Error("provider unavailable"), { code: "provider_error" });
    create.mockRejectedValue(providerError);

    await expect(askAssistant("Hello")).rejects.toBe(providerError);
    expect(logAiAuditEvent).toHaveBeenLastCalledWith(
      "request_failed",
      expect.objectContaining({ errorCode: "provider_error" }),
    );
  });

  it("stops an endless tool loop after five rounds", async () => {
    create.mockImplementation(async () => ({
      id: `resp-${create.mock.calls.length}`,
      output: [{ type: "function_call", name: "test_tool", call_id: "call-1", arguments: "{}" }],
    }));
    runAssistantTool.mockResolvedValue({ ok: true });

    await expect(askAssistant("Loop forever")).rejects.toMatchObject({
      code: "AI_TOOL_LIMIT",
      statusCode: 502,
    });
    expect(create).toHaveBeenCalledTimes(6);
  });
});
