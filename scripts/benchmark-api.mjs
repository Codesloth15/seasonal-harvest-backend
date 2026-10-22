// Sequential, read-only samples. No login, credentials, or payloads are printed.
import { gzipSync } from "node:zlib";

const options = process.argv.slice(2);
const option = (name, fallback) => {
  const index = options.indexOf(name);
  return index < 0 ? fallback : options[index + 1];
};
const base = new URL(option("--base-url", "http://localhost:3000"));
const samples = Number(option("--samples", "3"));
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
  throw new Error("Use an HTTP(S) base URL without credentials.");
}
if (!Number.isInteger(samples) || samples < 1 || samples > 10) {
  throw new Error("--samples must be between 1 and 10.");
}

for (const path of ["/health", "/api/v1/products", "/api/v1/categories", "/api/v1/brands"]) {
  for (let sample = 1; sample <= samples; sample += 1) {
    const started = performance.now();
    const response = await fetch(new URL(path, base), {
      signal: AbortSignal.timeout(75_000),
    });
    const headersMs = performance.now() - started;
    const raw = await response.text();
    const totalMs = performance.now() - started;
    const value = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    const rows = Array.isArray(value?.data) ? value.data : [];
    const fieldBytes = {};
    for (const row of rows) {
      for (const [key, field] of Object.entries(row)) {
        fieldBytes[key] = (fieldBytes[key] ?? 0) + Buffer.byteLength(JSON.stringify(field));
      }
    }
    console.log(JSON.stringify({
      path, sample, status: response.status,
      headersMs: Math.round(headersMs), totalMs: Math.round(totalMs),
      decodedBytes: Buffer.byteLength(raw), gzipEstimateBytes: gzipSync(raw).length,
      contentEncoding: response.headers.get("content-encoding"),
      wireContentLength: response.headers.get("content-length"),
      serverTiming: response.headers.get("server-timing"),
      records: rows.length, ...(sample === 1 && rows.length ? { fieldBytes } : {}),
      ...(path === "/api/v1/products" ? {
        embeddedImages: rows.filter((row) => typeof row.image_url === "string" && row.image_url.startsWith("data:")).length,
        estimatedBytesWithoutEmbeddedImages: Buffer.byteLength(JSON.stringify(value, (key, field) =>
          key === "image_url" && typeof field === "string" && field.startsWith("data:")
            ? "https://storage.example/product-image.webp" : field,
        )),
      } : {}),
    }));
  }
}
