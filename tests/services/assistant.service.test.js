import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const runAssistantTool = vi.fn();
const logAiAuditEvent = vi.fn();

vi.mock("../../config/gemini.js", () => ({
  getGeminiClient: () => ({ models: { generateContent } }),
}));
vi.mock("../../ai/tools/assistant-tools.js", () => ({
  assistantTools: [{ type: "function", name: "test_tool", description: "Test", parameters: { type: "object" } }],
  runAssistantTool,
}));
vi.mock("../../utils/ai-audit.js", () => ({ logAiAuditEvent }));

const { askAssistant } = await import("../../services/assistant.service.js");

describe("assistant service", () => {
  beforeEach(() => {
    generateContent.mockReset();
    runAssistantTool.mockReset();
    logAiAuditEvent.mockReset();
  });

  it("returns a direct Gemini answer and writes safe lifecycle audit events", async () => {
    generateContent.mockResolvedValue({ responseId: "resp-1", functionCalls: [], text: "Current stock is 10." });
    const result = await askAssistant("What is the stock?", { userId: "admin-1", role: "admin" });

    expect(result).toEqual({ answer: "Current stock is 10.", responseId: "resp-1" });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      contents: [{ role: "user", parts: [{ text: "What is the stock?" }] }],
      config: expect.objectContaining({ maxOutputTokens: 800 }),
    }));
    expect(logAiAuditEvent).toHaveBeenNthCalledWith(2, "request_succeeded", expect.objectContaining({ responseId: "resp-1" }));
  });

  it("executes Gemini function calls with authenticated context", async () => {
    generateContent
      .mockResolvedValueOnce({
        functionCalls: [{ name: "test_tool", args: { days: 30 } }],
        candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "test_tool", args: { days: 30 } } }] } }],
      })
      .mockResolvedValueOnce({ responseId: "resp-final", functionCalls: [], text: "Tool-backed answer." });
    runAssistantTool.mockResolvedValue({ count: 2 });

    await askAssistant("Use a tool", { accessToken: "token" });

    expect(runAssistantTool).toHaveBeenCalledWith("test_tool", { days: 30 }, { accessToken: "token" });
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      contents: expect.arrayContaining([
        { role: "user", parts: [{ functionResponse: { name: "test_tool", response: { result: { count: 2 } } } }] },
      ]),
    }));
  });

  it("audits Gemini failures and marks them as provider errors", async () => {
    const providerError = Object.assign(new Error("provider unavailable"), { status: 429 });
    generateContent.mockRejectedValue(providerError);
    await expect(askAssistant("Hello")).rejects.toBe(providerError);
    expect(providerError.isAiProviderError).toBe(true);
    expect(logAiAuditEvent).toHaveBeenLastCalledWith("request_failed", expect.objectContaining({ errorCode: "AI_REQUEST_FAILED" }));
  });

  it("formats low-stock tool results deterministically without a second Gemini call", async () => {
    generateContent.mockResolvedValue({
      responseId: "low-stock-response",
      functionCalls: [{ name: "get_low_stock_items", args: {} }],
      candidates: [{ content: { role: "model", parts: [] } }],
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
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("stops an endless tool loop after five rounds", async () => {
    generateContent.mockResolvedValue({
      functionCalls: [{ name: "test_tool", args: {} }],
      candidates: [{ content: { role: "model", parts: [] } }],
    });
    runAssistantTool.mockResolvedValue({ ok: true });
    await expect(askAssistant("Loop forever")).rejects.toMatchObject({ code: "AI_TOOL_LIMIT", statusCode: 502 });
    expect(generateContent).toHaveBeenCalledTimes(6);
  });
});
