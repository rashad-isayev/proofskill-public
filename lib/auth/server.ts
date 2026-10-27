import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookie } from "better-auth/cookies";
import { createAuth } from "./config";
import { isExperience, type Experience } from "./experience";

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuthService() {
  return (instance ??= createAuth());
}

export async function resolveSession(requestHeaders: Headers) {
  if (!getSessionCookie(requestHeaders, { cookiePrefix: "proofskill" }))
    return null;
  return getAuthService().auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
}

export const currentSession = cache(async () =>
  resolveSession(await headers()),
);

export async function requireExperience(
  experience: Experience | "either",
  destination: string,
) {
  let session;
  try {
    session = await currentSession();
  } catch {
    redirect("/auth?error=unavailable");
  }
  if (!session) redirect(`/auth?next=${encodeURIComponent(destination)}`);
  if (!isExperience(session.session.experience))
    redirect(`/auth?next=${encodeURIComponent(destination)}`);
  if (experience !== "either" && session.session.experience !== experience) {
    redirect("/auth?switch=1");
  }
  return session;
}
