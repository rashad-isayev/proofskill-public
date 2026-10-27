import { requireExperience } from "@/lib/auth/server";
import { CandidateDirectory } from "@/components/b2b/candidate-directory";
export const metadata = { title: "Candidates" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireExperience("enterprise", "/enterprise/candidates");
  const { assessment } = await searchParams;
  return (
    <CandidateDirectory
      initialAssessmentId={
        typeof assessment === "string" ? assessment : undefined
      }
    />
  );
}
