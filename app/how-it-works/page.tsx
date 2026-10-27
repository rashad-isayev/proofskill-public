import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata = { title: "How it works" };
export default function Page() {
  return (
    <MarketingPage
      audience="How it works"
      title="From a role to observable work."
      description="Your team shapes the assessment. Candidates demonstrate their reasoning. Reviewers inspect the evidence."
      sections={[
        [
          "Generate and review",
          "Describe the role, review the proposed competencies and 1\u20135 rubrics, edit weights and scenario families, then publish a locked version.",
        ],
        [
          "Invite and simulate",
          "Candidates open private invitations without an account. They work through adaptive tasks using company data, reference documents, and revealed information.",
        ],
        [
          "Review and decide",
          "Read the original responses, evidence sufficiency, uncertainty, and follow-up topics. Compare only compatible assessment versions and record your own decision.",
        ],
      ]}
    />
  );
}
