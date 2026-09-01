import { describe, expect, it, vi } from "vitest";
import { streamDataChanges } from "../../controller/events.controller.js";
import { publishDataChange } from "../../services/realtime-events.service.js";

describe("events controller", () => {
  it("opens an SSE stream and sends data-change events", () => {
    const closeHandlers = {};
    const req = {
      get: vi.fn(() => undefined),
      on: vi.fn((name, handler) => { closeHandlers[name] = handler; }),
    };
    const res = {
      status: vi.fn(),
      set: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
    };
    res.status.mockReturnValue(res);

    streamDataChanges(req, res);
    const event = publishDataChange({ resource: "product", action: "updated", id: "p-1" });

    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    }));
    expect(res.write).toHaveBeenCalledWith(`id: ${event.eventId}\n`);
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"resource":"product"'));
    closeHandlers.close();
  });
});
