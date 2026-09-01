import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/assistant.service.js", () => ({ askAssistant: vi.fn() }));

import { askAssistant } from "../../services/assistant.service.js";
import { chat } from "../../controller/assistant.controller.js";

const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe("assistant controller", () => {
  it("passes authenticated actor context for role-authorized tools", async () => {
    askAssistant.mockResolvedValue({ answer: "Two items.", responseId: "resp-1" });
    const res = response();
    const next = vi.fn();

    await chat(
      {
        body: { message: "  How many products?  " },
        user: { id: "admin-1" },
        profile: { role: "admin" },
        accessToken: "secret-token",
      },
      res,
      next,
    );

    expect(askAssistant).toHaveBeenCalledWith("How many products?", {
      userId: "admin-1",
      role: "admin",
      accessToken: "secret-token",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([undefined, "", " ", "x".repeat(2001)])("rejects an invalid message", async (message) => {
    const next = vi.fn();
    await chat({ body: { message } }, response(), next);

    expect(askAssistant).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
