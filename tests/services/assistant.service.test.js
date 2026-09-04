import { beforeEach, describe, expect, it, vi } from "vitest";

const createMessage = vi.fn();
const runAssistantTool = vi.fn();
const logAiAuditEvent = vi.fn();

vi.mock("../../config/anthropic.js", () => ({
  getAnthropicClient: () => ({ messages: { create: createMessage } }),
}));
vi.mock("../../ai/tools/assistant-tools.js", () => ({
  assistantTools: [{ type: "function", name: "test_tool", description: "Test", parameters: { type: "object" } }],
  runAssistantTool,
}));
vi.mock("../../utils/ai-audit.js", () => ({ logAiAuditEvent }));

const { askAssistant } = await import("../../services/assistant.service.js");

describe("assistant service", () => {
  beforeEach(() => {
    createMessage.mockReset();
    runAssistantTool.mockReset();
    logAiAuditEvent.mockReset();
  });

  it("returns a direct Claude answer and writes safe lifecycle audit events", async () => {
    createMessage.mockResolvedValue({
      id: "resp-1",
      content: [{ type: "text", text: "Current stock is 10." }],
    });
    const result = await askAssistant(
      "What is the stock?",
      { userId: "admin-1", role: "admin" },
      [
        { role: "user", content: "Remember product A." },
        { role: "assistant", content: "I will remember product A." },
      ],
    );

    expect(result).toEqual({ answer: "Current stock is 10.", responseId: "resp-1" });
    expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        { role: "user", content: "Remember product A." },
        { role: "assistant", content: "I will remember product A." },
        { role: "user", content: "What is the stock?" },
      ],
      max_tokens: 800,
      tools: [expect.objectContaining({
        name: "test_tool",
        input_schema: { type: "object" },
      })],
    }));
    expect(logAiAuditEvent).toHaveBeenNthCalledWith(2, "request_succeeded", expect.objectContaining({ responseId: "resp-1" }));
  });

  it("executes Claude tool calls with authenticated context", async () => {
    createMessage
      .mockResolvedValueOnce({
        id: "resp-tool",
        content: [{
          type: "tool_use",
          id: "tool-1",
          name: "test_tool",
          input: { days: 30 },
        }],
      })
      .mockResolvedValueOnce({
        id: "resp-final",
        content: [{ type: "text", text: "Tool-backed answer." }],
      });
    runAssistantTool.mockResolvedValue({ count: 2 });

    await askAssistant("Use a tool", { accessToken: "token" });

    expect(runAssistantTool).toHaveBeenCalledWith("test_tool", { days: 30 }, { accessToken: "token" });
    expect(createMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      messages: expect.arrayContaining([
        {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: "tool-1",
            content: "{\"count\":2}",
          }],
        },
      ]),
    }));
  });

  it("audits Claude failures and marks them as provider errors", async () => {
    const providerError = Object.assign(new Error("provider unavailable"), { status: 429 });
    createMessage.mockRejectedValue(providerError);
    await expect(askAssistant("Hello")).rejects.toBe(providerError);
    expect(providerError.isAiProviderError).toBe(true);
    expect(logAiAuditEvent).toHaveBeenLastCalledWith("request_failed", expect.objectContaining({ errorCode: "AI_REQUEST_FAILED" }));
  });

  it("formats low-stock tool results deterministically without a second Claude call", async () => {
    createMessage.mockResolvedValue({
      id: "low-stock-response",
      content: [{
        type: "tool_use",
        id: "tool-low",
        name: "get_low_stock_items",
        input: {},
      }],
    });
    runAssistantTool.mockResolvedValue({
      items: [
        { name: "Kikiam", displayQuantity: 0, displayUnit: "SACK" },
        { name: "Hotdog", displayQuantity: 5, displayUnit: "BOX" },
      ],
    });

    const result = await askAssistant("Show low-stock products", { accessToken: "token" });

    expect(result).toEqual({
      answer: "Kikiam: 0 SACK\nHotdog: 5 BOX",
      responseId: "low-stock-response",
    });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("stops an endless tool loop after five rounds", async () => {
    createMessage.mockResolvedValue({
      id: "loop-response",
      content: [{
        type: "tool_use",
        id: "tool-loop",
        name: "test_tool",
        input: {},
      }],
    });
    runAssistantTool.mockResolvedValue({ ok: true });
    await expect(askAssistant("Loop forever")).rejects.toMatchObject({ code: "AI_TOOL_LIMIT", statusCode: 502 });
    expect(createMessage).toHaveBeenCalledTimes(6);
  });
});
