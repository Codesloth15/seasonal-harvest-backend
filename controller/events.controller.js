import { subscribeToDataChanges } from "../services/realtime-events.service.js";

const HEARTBEAT_INTERVAL_MS = 25_000;

const writeEvent = (res, event) => {
  res.write(`id: ${event.eventId}\n`);
  res.write("event: data-change\n");
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

export const streamDataChanges = (req, res) => {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write("retry: 3000\n\n");

  const unsubscribe = subscribeToDataChanges(
    (event) => writeEvent(res, event),
    req.get("Last-Event-ID"),
  );
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};
