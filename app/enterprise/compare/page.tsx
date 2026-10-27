import { requireExperience } from "@/lib/auth/server";
import { CompareCandidates } from "@/components/b2b/compare";
export const metadata = { title: "Compare candidates" };
export default async function Page() {
  await requireExperience("enterprise", "/enterprise/compare");
  return <CompareCandidates />;
}
