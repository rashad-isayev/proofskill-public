import { redirect } from "next/navigation";
import { requireExperience } from "@/lib/auth/server";

// Existing bookmarks open the catalog dialog instead of a standalone creator.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireExperience("enterprise", "/enterprise/assessments/new");
  const { from } = await searchParams;
  const query = new URLSearchParams({ create: "1" });
  if (typeof from === "string") query.set("from", from);
  redirect(`/enterprise/assessments?${query}`);
}
