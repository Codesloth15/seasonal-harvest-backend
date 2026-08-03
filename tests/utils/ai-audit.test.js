import { describe, expect, it, vi } from "vitest";
import { logAiAuditEvent } from "../../utils/ai-audit.js";

describe("AI audit logger", () => {
  it("logs metadata but no prompt or access token", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logAiAuditEvent("request_succeeded", {
      userId: "admin-1",
      role: "admin",
      messageLength: 20,
      responseId: "resp-1",
      accessToken: "must-not-be-logged",
      message: "must-not-be-logged",
    });

    const record = JSON.parse(info.mock.calls[0][0]);
    expect(record).toMatchObject({
      event: "ai.request_succeeded",
      userId: "admin-1",
      role: "admin",
      messageLength: 20,
      responseId: "resp-1",
    });
    expect(record).not.toHaveProperty("accessToken");
    expect(record).not.toHaveProperty("message");
  });

  it("rejects unknown event names", () => {
    expect(() => logAiAuditEvent("prompt_contents", {})).toThrow("Unsupported AI audit event");
  });
});
