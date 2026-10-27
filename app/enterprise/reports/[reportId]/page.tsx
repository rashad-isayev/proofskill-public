import { requireExperience } from "@/lib/auth/server";
import { HRReport } from "@/components/b2b/report";
export const metadata = { title: "Candidate report" };
export default async function Page({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  await requireExperience(
    "enterprise",
    "/enterprise/reports/" + encodeURIComponent(reportId),
  );
  return <HRReport key={reportId} id={reportId} />;
}
