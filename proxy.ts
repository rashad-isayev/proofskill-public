import { isMarketingPage } from "@/lib/marketing";
import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth/server";
import { isExperience, routeExperience } from "@/lib/auth/experience";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    /^\/(workspace|labs|jobs|applications|evidence|profile|recruiter|reports|simulations)(\/|$)/.test(
      path,
    ) ||
    /^\/enterprise\/(legacy|jobs)(\/|$)/.test(path) ||
    /^\/api\/(account|jobs|applications)(\/|$)/.test(path) ||
    path === "/api/assessments/demo"
  )
    return new NextResponse(null, { status: 404 });
  // Explicit public surface. All other routes, including future APIs, fail closed.
  if (
    isMarketingPage(path) ||
    /^\/api\/invites\/[a-f0-9]{64}$/.test(path) ||
    /^\/api\/invites\/[a-f0-9]{64}\/recording$/.test(path) ||
    /^\/api\/simulations\/[a-f0-9-]{36}\/recordings$/.test(path) ||
    /^\/api\/recordings\/[a-f0-9-]{36}\/(finalize|chunks\/(?:0|[1-9]\d{0,2}))$/.test(
      path,
    ) ||
    /^\/api\/invites\/[a-f0-9]{64}\/monitoring(?:\/(consent|ready))?$/.test(
      path,
    ) ||
    /^\/api\/simulations\/[a-f0-9-]{36}\/monitoring\/events$/.test(path) ||
    /^\/invite\/[^/]{1,128}$/.test(path) ||
    /^\/api\/simulations\/(start|respond|complete|draft|[a-f0-9-]{36})$/.test(
      path,
    ) ||
    ["/auth", "/auth/sign-in", "/auth/sign-up"].includes(path) ||
    path.startsWith("/api/auth/")
  )
    return NextResponse.next();
  const api = path.startsWith("/api/");
  let session;
  try {
    session = await resolveSession(request.headers);
  } catch {
    return api
      ? NextResponse.json(
          {
            error: {
              code: "AUTH_UNAVAILABLE",
              message: "Authentication is unavailable.",
            },
          },
          { status: 503 },
        )
      : NextResponse.redirect(new URL("/auth?error=unavailable", request.url));
  }
  if (!session || !isExperience(session.session.experience)) {
    if (api)
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    const url = new URL("/auth", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const experience = routeExperience(path);
  if (
    experience &&
    experience !== "either" &&
    experience !== session.session.experience
  ) {
    return api
      ? NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "This action is unavailable in this workspace.",
            },
          },
          { status: 403 },
        )
      : NextResponse.redirect(new URL("/auth?switch=1", request.url));
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
