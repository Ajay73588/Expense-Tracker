// Structured JSON logger with automatic credential & secret redaction.
// In production this would be routed to CloudWatch / Datadog / etc.

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_REGEX = /(?:password|secret|token|apikey|api_key|auth|cookie|private_?key|credential)/i;
const DB_URL_PASSWORD_REGEX = /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/i;

/** Scrubs sensitive patterns (database URLs, Bearer tokens) from raw strings. */
export function sanitizeString(str: string): string {
  let cleaned = str;
  if (DB_URL_PASSWORD_REGEX.test(cleaned)) {
    cleaned = cleaned.replace(DB_URL_PASSWORD_REGEX, `$1${REDACTED_VALUE}$3`);
  }
  if (/Bearer\s+[A-Za-z0-9_\-.]+/i.test(cleaned)) {
    cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9_\-.]+/gi, `Bearer ${REDACTED_VALUE}`);
  }
  return cleaned;
}

/** Recursively scrubs secret keys and sensitive patterns from log fields. */
export function sanitizeFields(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFields(item, depth + 1));
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        cleaned[k] = REDACTED_VALUE;
      } else {
        cleaned[k] = sanitizeFields(v, depth + 1);
      }
    }
    return cleaned;
  }

  return obj;
}

function emit(level: LogLevel, service: string, message: string, fields: LogFields = {}) {
  const sanitizedMessage = typeof message === "string" ? sanitizeString(message) : String(message);
  const sanitizedFields = (sanitizeFields(fields) as LogFields) || {};
  const entry = {
    level,
    ts: new Date().toISOString(),
    service,
    message: sanitizedMessage,
    ...sanitizedFields,
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
