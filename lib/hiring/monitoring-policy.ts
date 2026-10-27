import { monitoringPolicySchema } from "@/lib/b2b/monitoring-contract";
export const monitoringNotice =
  "This assessment requires camera access, entire-screen sharing and fullscreen. Activity signals and consent are stored for the hiring team's review. Three fullscreen exits close this attempt. No audio, camera images or screen video are recorded or uploaded. You can withdraw consent; task access will pause while the deadline continues. Contact the hiring team for an alternative or human review. Browser checks cannot lock other applications or prove cheating.";
export function defaultMonitoring() {
  return monitoringPolicySchema.parse({
    version: 1,
    enabled: false,
    restrictClipboard: false,
    notice: monitoringNotice,
  });
}
