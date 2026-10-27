import { boundedJson } from "@/lib/auth/input";
import { NextRequest, NextResponse } from "next/server";
import { getAuthService, resolveSession } from "@/lib/auth/server";
import { safeDestination } from "@/lib/auth/experience";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // A session cookie alone is insufficient for mutations: reject cross-origin requests.
  const configuredOrigin = process.env.BETTER_AUTH_URL;
  if (
    !configuredOrigin ||
    request.headers.get("origin") !== new URL(configuredOrigin).origin
  ) {
    return NextResponse.json(
      { message: "This request is not allowed." },
      { status: 403 },
    );
  }
  try {
    const session = await resolveSession(request.headers);
    if (!session)
      return NextResponse.json(
        { message: "Sign in to continue." },
        { status: 401 },
      );
    const value = await boundedJson(request, 2048);
    const body =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null;
    if (!body || body.experience !== "enterprise") {
      return NextResponse.json(
        { message: "Only HR accounts use the hiring workspace." },
        { status: 400 },
      );
    }
    const result = await getAuthService().pool.query(
      'UPDATE "proofskill_auth_session" SET "experience" = $1 WHERE "id" = $2 AND "userId" = $3 AND "expiresAt" > NOW() RETURNING "id"',
      [body.experience, session.session.id, session.user.id],
    );
    if (result.rowCount !== 1)
      return NextResponse.json(
        { message: "Sign in again to continue." },
        { status: 401 },
      );
    return NextResponse.json(
      { destination: safeDestination(body.next, body.experience) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Your workspace could not be opened. Please try again." },
      { status: 503 },
    );
  }
}
