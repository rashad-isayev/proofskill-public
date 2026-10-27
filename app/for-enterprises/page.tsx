import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata = { title: "For hiring teams" };
export default function Page() {
  return (
    <MarketingPage
      audience="For hiring teams"
      title="Build your assessment around the work."
      description="Create a role-specific blueprint and inspect how candidates handle comparable workplace situations."
      sections={[
        [
          "Control the blueprint",
          "Edit competencies, indicators, weights, rubrics, and scenario families before publishing. Existing sessions keep their locked assessment version.",
        ],
        [
          "Manage the process",
          "Create invitations, track candidate progress, and open completed evidence reports from your HR workspace.",
        ],
        [
          "Make an independent decision",
          "Inspect exact response quotes and gaps in coverage. Compare compatible reports without rankings, then record notes and a human decision.",
        ],
      ]}
    />
  );
}
