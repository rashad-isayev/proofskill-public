import { monitoringStatus } from "@/lib/hiring/monitoring";
import { recordingPolicy } from "@/lib/recording/store";
import { inviteEntry } from "@/lib/hiring/store";
import { CandidateWorkspace } from "@/components/b2b/candidate-workspace";
export const metadata = {
  title: "Candidate assessment",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  try {
    if ((await inviteEntry(token)).status === "archived") {
      try {
        if (!(await monitoringStatus(token)).state.disqualified) return null;
      } catch {
        return null;
      }
    }
  } catch {
    /* Invalid/unavailable links use the candidate error state. */
  }
  return (
    <CandidateWorkspace
      key={token}
      token={token}
      monitoringConnected
      recordingConfigured={recordingPolicy().enabled}
    />
  );
}
