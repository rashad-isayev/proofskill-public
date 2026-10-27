import { redirect } from "next/navigation";

// Keep existing entry links and session guards compatible with the new pages.
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["next", "switch", "error"]) {
    if (typeof params[key] === "string") query.set(key, params[key]);
  }
  redirect(`/auth/sign-in${query.size ? `?${query}` : ""}`);
}
