// Test-only component host. Never imported into the Next.js application.
import { createRoot } from "react-dom/client";
import { AppShell } from "../../../components/layout/app-shell";
import { HRDashboard } from "../../../components/b2b/dashboard";
import { CreateAssessment } from "../../../components/b2b/create-assessment";
import { AssessmentDetail } from "../../../components/b2b/assessment-detail";
import { CandidateDirectory } from "../../../components/b2b/candidate-directory";
import { HRCatalog } from "../../../components/b2b/catalog";
import { HRReport } from "../../../components/b2b/report";
import { CompareCandidates } from "../../../components/b2b/compare";
import { CandidateWorkspace } from "../../../components/b2b/candidate-workspace";
import { MonitoringSettings } from "../../../components/b2b/monitoring-settings";
const path = location.pathname;
const query = new URLSearchParams(location.search);
const screen =
  path === "/monitoring-candidate" ? (
    <CandidateWorkspace token="private-token" monitoringConnected />
  ) : path === "/monitoring-settings" ? (
    <MonitoringSettings assessmentId="a1" connected />
  ) : path.endsWith("/assessments/a1/edit") ? (
    <CreateAssessment from="a1" />
  ) : path.endsWith("/assessments/a1") ? (
    <AssessmentDetail id="a1" />
  ) : path.includes("/reports/") ? (
    <HRReport id={path.split("/").pop()!} />
  ) : path.includes("/compare") ? (
    <CompareCandidates />
  ) : path.includes("/candidates") ? (
    <CandidateDirectory
      initialAssessmentId={query.get("assessment") || undefined}
    />
  ) : path.includes("/reports") ? (
    <HRCatalog mode="reports" />
  ) : path.includes("/assessments") ? (
    <HRCatalog
      mode="assessments"
      initialCreate={query.get("create") === "1" || path.endsWith("/new")}
      from={query.get("from") || undefined}
    />
  ) : (
    <HRDashboard />
  );
const shell =
  document.body.dataset.preview === "true" ||
  new URLSearchParams(location.search).has("shell");
createRoot(document.getElementById("root")!).render(
  shell && !path.startsWith("/monitoring-") ? (
    <AppShell viewer={{ name: "Preview user", experience: "enterprise" }}>
      {screen}
    </AppShell>
  ) : (
    screen
  ),
);
