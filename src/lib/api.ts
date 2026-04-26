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

export function handleError(err: unknown) {
  if (err instanceof AppError) {
    return fail(err.message, err.code, err.status);
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  log.error("Unhandled API error", { message });
  return fail(message, "INTERNAL_ERROR", 500);
}
