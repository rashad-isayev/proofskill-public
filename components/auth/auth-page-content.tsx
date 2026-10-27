import { redirect } from "next/navigation";
import { AuthInterface } from "@/components/auth/auth-interface";
import { currentSession } from "@/lib/auth/server";
import { safeDestination } from "@/lib/auth/experience";

export async function AuthPageContent({
  mode,
  searchParams,
}: {
  mode: "sign-in" | "sign-up";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let session = null;
  let unavailable = params.error === "unavailable";
  try {
    session = await currentSession();
  } catch {
    unavailable = true;
  }
  const next = typeof params.next === "string" ? params.next : undefined;
  if (
    session &&
    session.session.experience === "enterprise" &&
    params.switch !== "1"
  ) {
    redirect(safeDestination(next, session.session.experience));
  }
  return (
    <AuthInterface
      key={mode}
      mode={mode}
      signedIn={!!session}
      next={next}
      unavailable={unavailable}
    />
  );
}
