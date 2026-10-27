import { boundedJson, signInInput, signUpInput } from "@/lib/auth/input";
import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/auth/server";

export const runtime = "nodejs";
const methods: Record<string, string> = {
  "sign-up/email": "POST",
  "sign-in/email": "POST",
  "sign-out": "POST",
  "get-session": "GET",
};

async function handler(request: NextRequest) {
  const path = request.nextUrl.pathname.slice("/api/auth/".length);
  if (methods[path] !== request.method)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    let forwarded: Request = request;
    if (path === "sign-up/email" || path === "sign-in/email") {
      const schema = path === "sign-up/email" ? signUpInput : signInInput;
      const input = schema.safeParse(await boundedJson(request));
      if (!input.success)
        return NextResponse.json(
          { message: "Check your account details and try again." },
          { status: 400 },
        );
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      forwarded = new Request(request.url, {
        method: request.method,
        headers,
        body: JSON.stringify(input.data),
      });
    }
    const response = await getAuthService().auth.handler(forwarded);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return NextResponse.json(
      { message: "Sign-in is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export const GET = handler;
export const POST = handler;
