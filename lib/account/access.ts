import "server-only";
import { currentSession } from "@/lib/auth/server";
import { isExperience, type Experience } from "@/lib/auth/experience";
import { NextResponse } from "next/server";
import { AccountError } from "./error";
export { AccountError } from "./error";
export { boundedJSON } from "./request";
export async function accountViewer(
  experience: Experience | "either" = "either",
) {
  const session = await currentSession();
  if (!session || !isExperience(session.session.experience))
    throw new AccountError("Sign in to continue.", 401);
  if (experience !== "either" && session.session.experience !== experience)
    throw new AccountError("Switch to the correct workspace.", 403);
  return session;
}
export function checkOrigin(request: Request) {
  if (
    !process.env.BETTER_AUTH_URL ||
    request.headers.get("origin") !==
      new URL(process.env.BETTER_AUTH_URL).origin
  )
    throw new AccountError("Request origin is not allowed.", 403);
}
export function apiFailure(error: unknown) {
  return NextResponse.json(
    {
      error: {
        message:
          error instanceof AccountError
            ? error.message
            : "Account database is unavailable. Please try again.",
      },
    },
    { status: error instanceof AccountError ? error.status : 503 },
  );
}
