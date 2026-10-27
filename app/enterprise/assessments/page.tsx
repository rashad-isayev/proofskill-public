import { requireExperience } from "@/lib/auth/server";
import { HRCatalog } from "@/components/b2b/catalog";
export const metadata = { title: "Assessments" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireExperience("enterprise", "/enterprise/assessments");
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;
  return (
    <HRCatalog
      key={`${params.create === "1"}-${from ?? ""}`}
      mode="assessments"
      initialCreate={params.create === "1"}
      from={from}
    />
  );
}
