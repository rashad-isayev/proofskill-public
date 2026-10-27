import { requireExperience } from "@/lib/auth/server";
import { CreateAssessment } from "@/components/b2b/create-assessment";
export const metadata = { title: "Edit assessment" };
export default async function Page({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  await requireExperience(
    "enterprise",
    "/enterprise/assessments/" + encodeURIComponent(assessmentId) + "/edit",
  );
  return <CreateAssessment from={assessmentId} />;
}
