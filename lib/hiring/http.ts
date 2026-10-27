import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  accountViewer,
  checkOrigin,
  boundedJSON,
  AccountError,
} from "@/lib/account/access";
import { HiringError } from "./error";
import { ModelError } from "./llm";
export async function hr() {
  return (await accountViewer("enterprise")).user.id;
}
export function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  if (!/^Bearer [a-f0-9]{64}$/.test(value))
    throw new AccountError("A valid candidate invitation is required.", 401);
  return value.slice(7);
}
export async function body<T>(request: Request, schema: z.ZodType<T>) {
  checkOrigin(request);
  return schema.parse(await boundedJSON(request, 100000));
}
export async function response(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof AccountError ||
            error instanceof HiringError ||
            error instanceof ModelError
              ? error.message
              : error instanceof z.ZodError
                ? "Invalid request. Check all fields."
                : "The database is unavailable. Your saved work is intact. Retry.",
        },
      },
      {
        status:
          error instanceof AccountError || error instanceof HiringError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : error instanceof ModelError
                ? 502
                : 503,
        headers: {
          "Cache-Control": "no-store",
          ...(error instanceof HiringError && error.retryAfterSeconds
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : {}),
        },
      },
    );
  }
}
