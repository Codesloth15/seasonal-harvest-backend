import { describe, expect, it, vi } from "vitest";
import {
  publishDataChange,
  subscribeToDataChanges,
} from "../../services/realtime-events.service.js";

describe("real-time event service", () => {
  it("publishes catalog invalidation events to subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDataChanges(listener);

    const event = publishDataChange({ resource: "product", action: "updated", id: "p-1" });

    expect(listener).toHaveBeenCalledWith(event);
    expect(event).toMatchObject({ resource: "product", action: "updated", id: "p-1" });
    expect(event.eventId).toBeTruthy();
    unsubscribe();
  });

  it("replays events newer than Last-Event-ID", () => {
    const first = publishDataChange({ resource: "inventory", action: "adjusted", id: "i-1" });
    const second = publishDataChange({ resource: "inventory", action: "adjusted", id: "i-2" });
    const listener = vi.fn();

    const unsubscribe = subscribeToDataChanges(listener, first.eventId);

    expect(listener).toHaveBeenCalledWith(second);
    unsubscribe();
  });
});
