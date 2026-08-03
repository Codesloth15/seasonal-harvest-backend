import { describe, expect, it, vi } from "vitest";
import { createAssistantRateLimit } from "../../middleware/assistant-rate-limit.middleware.js";

const createResponse = () => {
  const res = { set: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe("assistant rate limit", () => {
  it("limits each authenticated user independently", () => {
    const middleware = createAssistantRateLimit({ max: 1, windowMs: 60_000, now: () => 1_000 });
    const firstNext = vi.fn();
    const blockedNext = vi.fn();
    const otherNext = vi.fn();

    middleware({ user: { id: "admin-1" } }, createResponse(), firstNext);
    const blockedResponse = createResponse();
    middleware({ user: { id: "admin-1" } }, blockedResponse, blockedNext);
    middleware({ user: { id: "admin-2" } }, createResponse(), otherNext);

    expect(firstNext).toHaveBeenCalledOnce();
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith(expect.objectContaining({ code: "AI_RATE_LIMITED" }));
    expect(otherNext).toHaveBeenCalledOnce();
  });

  it("allows requests again after the window resets", () => {
    let time = 1_000;
    const middleware = createAssistantRateLimit({ max: 1, windowMs: 100, now: () => time });
    middleware({ user: { id: "admin-1" } }, createResponse(), vi.fn());
    time = 1_100;
    const next = vi.fn();

    middleware({ user: { id: "admin-1" } }, createResponse(), next);

    expect(next).toHaveBeenCalledOnce();
  });
});
