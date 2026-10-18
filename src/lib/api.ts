import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("api");

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, code = "INTERNAL_ERROR", status = 500) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function rateLimited(retryAfterSeconds = 60, message = "Too many requests. Please slow down and try again later.") {
  return NextResponse.json(
    { ok: false, error: { code: "RATE_LIMITED", message } },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

export function handleError(err: unknown) {
  if (err instanceof AppError) {
    return fail(err.message, err.code, err.status);
  }

  // Handle duck-typed or custom errors with numeric status code
  if (err && typeof err === "object") {
    const status = "status" in err && typeof (err as any).status === "number" ? (err as any).status : undefined;
    const code = "code" in err && typeof (err as any).code === "string" ? (err as any).code : undefined;
    const message = err instanceof Error ? err.message : ("message" in err && typeof (err as any).message === "string" ? (err as any).message : "Unknown error");

    if (status && status >= 400 && status < 500) {
      const defaultCode = status === 404 ? "NOT_FOUND" : status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 409 ? "CONFLICT" : "BAD_REQUEST";
      return fail(message, code || defaultCode, status);
    }
  }

  const rawMessage = err instanceof Error ? err.message : "Unknown error";
  const isProdOrStaging =
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "staging" ||
    process.env.APP_ENV === "production";
  const safeMessage = isProdOrStaging ? "Internal server error" : rawMessage;
  return fail(safeMessage, "INTERNAL_ERROR", 500);
}

