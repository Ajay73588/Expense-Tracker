// Structured JSON logger. Matches the format described in the architecture doc.
// In production this would be routed to CloudWatch / Datadog / etc.

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, service: string, message: string, fields: LogFields = {}) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    service,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(service: string) {
  return {
    debug: (message: string, fields?: LogFields) => emit("debug", service, message, fields),
    info: (message: string, fields?: LogFields) => emit("info", service, message, fields),
    warn: (message: string, fields?: LogFields) => emit("warn", service, message, fields),
    error: (message: string, fields?: LogFields) => emit("error", service, message, fields),
  };
}
