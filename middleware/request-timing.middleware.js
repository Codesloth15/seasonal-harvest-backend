import { randomUUID } from "node:crypto";
import onHeaders from "on-headers";
import { requestTimingContext } from "../utils/request-timing.js";

const configuredThreshold = Number(process.env.SLOW_REQUEST_MS ?? 1000);
const slowRequestMs = Number.isFinite(configuredThreshold) && configuredThreshold >= 0
  ? configuredThreshold
  : 1000;

const requestTiming = (req, res, next) => {
  const context = { timings: Object.create(null) };
  const requestId = randomUUID();
  const started = performance.now();
  let headersMs;
  let route;
  res.setHeader("X-Request-ID", requestId);

  const logIfSlow = (durationMs) => {
    if (durationMs < slowRequestMs) return;
    console.warn(JSON.stringify({
      event: "slow_request",
      requestId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      timings: Object.fromEntries(Object.entries(context.timings).map(([name, value]) =>
        [name, { durationMs: Math.round(value.duration), calls: value.count }],
      )),
    }));
  };
  const isStreaming = () => String(res.getHeader("Content-Type") ?? "").startsWith("text/event-stream");

  onHeaders(res, function () {
    headersMs = performance.now() - started;
    // Use the route template, never IDs, search terms, or credentials from URLs.
    route = req.route ? `${req.baseUrl}${req.route.path}` : "/api/v1/<unmatched>";
    const timings = Object.entries(context.timings).map(([name, value]) =>
      `${name};dur=${value.duration.toFixed(1)};desc="${value.count} calls"`,
    );
    timings.push(`total;dur=${headersMs.toFixed(1)}`);
    this.setHeader("Server-Timing", timings.join(", "));
    // Streams usually close on disconnect without emitting finish.
    if (isStreaming()) logIfSlow(headersMs);
  });

  res.once("finish", () => {
    // A long-lived event stream is measured until its headers are sent.
    if (!isStreaming()) logIfSlow(performance.now() - started);
  });

  requestTimingContext.run(context, next);
};

export default requestTiming;
