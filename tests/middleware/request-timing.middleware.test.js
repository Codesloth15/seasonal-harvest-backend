import express from "express";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { measureRequest, timedSupabaseFetch } from "../../utils/request-timing.js";

vi.stubEnv("SLOW_REQUEST_MS", "0");
const { default: requestTiming } = await import("../../middleware/request-timing.middleware.js");

describe("request timing", () => {
  let server;
  let base;

  beforeAll(async () => {
    const app = express();
    app.use("/api/v1", requestTiming);
    const router = express.Router();
    router.get("/:id", async (req, res, next) => {
      try {
        const value = await measureRequest(req.params.id === "first" ? "auth" : "role", async () => {
          await Promise.resolve();
          return "ok";
        });
        res.json({ value });
      } catch (error) { next(error); }
    });
    router.get("/failure/:id", async (_req, res) => {
      try {
        await measureRequest("supabase", () => Promise.reject(new Error("upstream failed")));
      } catch {
        res.status(502).json({ error: "unavailable" });
      }
    });
    router.get("/events/stream", (_req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.flushHeaders();
      res.write(": ready\n\n");
    });
    app.use("/api/v1/items", router);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("isolates concurrent requests, emits timings, and logs only route templates", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [first, second] = await Promise.all([
      fetch(`${base}/api/v1/items/first?access_token=secret-one`),
      fetch(`${base}/api/v1/items/second?search=secret-two`),
    ]);
    await Promise.all([first.text(), second.text()]);

    expect(first.headers.get("server-timing")).toMatch(/auth;dur=[\d.]+;desc="1 calls"/);
    expect(first.headers.get("server-timing")).not.toContain("role;");
    expect(second.headers.get("server-timing")).toContain("role;");
    expect(second.headers.get("server-timing")).not.toContain("auth;");
    expect(first.headers.get("server-timing")).toMatch(/total;dur=[\d.]+/);
    expect(first.headers.get("x-request-id")).not.toEqual(second.headers.get("x-request-id"));
    const events = log.mock.calls.map(([value]) => JSON.parse(value));
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.route === "/api/v1/items/:id")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("secret-");
    expect(events.map((event) => event.requestId)).toContain(first.headers.get("x-request-id"));
  });

  it("includes failed dependency work and preserves the error response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await fetch(`${base}/api/v1/items/failure/private-id`);
    expect(response.status).toBe(502);
    expect(response.headers.get("server-timing")).toContain("supabase;");
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("logs slow event-stream startup without waiting for the connection to finish", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await fetch(`${base}/api/v1/items/events/stream`);
    expect(response.headers.get("server-timing")).toContain("total;");
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      event: "slow_request", route: "/api/v1/items/events/stream", status: 200,
    });
    await response.body.cancel();
  });

  it("preserves fetch arguments and response outside an HTTP timing context", async () => {
    const response = new Response("ok");
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const options = { headers: { Authorization: "Bearer opaque" } };
    try {
      await expect(timedSupabaseFetch("https://project.test/rest/v1/products", options)).resolves.toBe(response);
      expect(fetchMock).toHaveBeenCalledWith("https://project.test/rest/v1/products", options);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
