import { requireExperience } from "@/lib/auth/server";
import { AssessmentDetail } from "@/components/b2b/assessment-detail";
import { recordingPolicy } from "@/lib/recording/store";
export const metadata = { title: "Assessment" };
export default async function Page({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  await requireExperience(
    "enterprise",
    "/enterprise/assessments/" + encodeURIComponent(assessmentId),
  );
  return (
    <AssessmentDetail
      key={assessmentId}
      id={assessmentId}
      monitoringConnected
      recordingConfigured={recordingPolicy().enabled}
    />
  );
}
