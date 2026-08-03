const ALLOWED_EVENTS = new Set(["request_started", "request_succeeded", "request_failed"]);

export const logAiAuditEvent = (event, details = {}) => {
  if (!ALLOWED_EVENTS.has(event)) throw new Error("Unsupported AI audit event.");

  const record = {
    timestamp: new Date().toISOString(),
    event: `ai.${event}`,
    userId: details.userId || null,
    role: details.role || null,
    messageLength: details.messageLength,
    durationMs: details.durationMs,
    responseId: details.responseId,
    errorCode: details.errorCode,
  };

  console.info(JSON.stringify(Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))));
};
