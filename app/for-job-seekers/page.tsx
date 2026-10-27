import { MarketingPage } from "@/components/marketing/marketing-page";
export const metadata = { title: "For candidates" };
export default function Page() {
  return (
    <MarketingPage
      audience="For candidates"
      title="Show how you approach real work."
      description="Your hiring team sends a private assessment link. You join a realistic workplace without creating an account."
      sections={[
        [
          "Read your invitation",
          "See the role and assessment duration before starting. The countdown begins when the server starts your session.",
        ],
        [
          "Work through the situation",
          "Respond to your manager, inspect company data, and adapt as new information arrives. Explain your calculations and trade-offs.",
        ],
        [
          "Submit for human review",
          "Your work goes to the hiring team. AI assessment is advisory and the team makes its own decisions. Keep your invitation link private.",
        ],
      ]}
      candidate
    />
  );
}
