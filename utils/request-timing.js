import { AsyncLocalStorage } from "node:async_hooks";

export const requestTimingContext = new AsyncLocalStorage();

// Sum time spent awaiting each dependency. Parallel calls can overlap, so these
// values describe dependency work and are not additive parts of total latency.
export const measureRequest = async (name, operation) => {
  const context = requestTimingContext.getStore();
  if (!context) return operation();

  const started = performance.now();
  try {
    return await operation();
  } finally {
    const timing = context.timings[name] ?? { duration: 0, count: 0 };
    timing.duration += performance.now() - started;
    timing.count += 1;
    context.timings[name] = timing;
  }
};

export const timedSupabaseFetch = (...args) =>
  measureRequest("supabase", () => fetch(...args));
