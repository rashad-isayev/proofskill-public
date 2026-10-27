// Frontend-only example fixture. Not a real assessment or an API contract.
// Developer 2 will supply the validated shared report schema and evaluator.
export const sampleReport = {
  title: "Junior Product Analyst",
  scenario: "The product launch",
  rubricVersion: "draft-1",
  responses: {
    analysis: "Signups fall from 6,000 to 1,800 activated users, a 70% drop-off. This is the largest proportional drop in the funnel. I would inspect onboarding steps before assuming acquisition is the problem.",
    recommendations: "First, inspect onboarding errors and segment activation by device. Second, test a shorter onboarding flow. Prioritize diagnosis before a redesign because we do not yet know whether friction or a technical issue causes the drop-off.",
    stakeholderUpdate: "The main bottleneck appears to be activation: only 30% of signups activate. I recommend checking onboarding errors today, then testing a shorter flow. Track signup-to-activation conversion as the success metric. Device-level data is needed before we choose the fix.",
  },
  skills: [
    { id: "analytical-thinking", label: "Analytical thinking", score: 86, task: "analysis", quote: "Signups fall from 6,000 to 1,800 activated users, a 70% drop-off.", rationale: "Identifies the largest proportional drop and supports it with the correct calculation.", improvement: "Compare the current funnel with a prior period to separate a new regression from an existing problem." },
    { id: "problem-solving", label: "Problem solving", score: 78, task: "recommendations", quote: "First, inspect onboarding errors and segment activation by device.", rationale: "Connects a specific investigation to the suspected bottleneck, rather than immediately redesigning the product.", improvement: "Describe what findings would distinguish a technical error from user friction." },
    { id: "prioritization", label: "Prioritization", score: 72, task: "recommendations", quote: "Prioritize diagnosis before a redesign because we do not yet know whether friction or a technical issue causes the drop-off.", rationale: "Explains the order of actions and acknowledges uncertainty. Effort and potential impact are not yet quantified.", improvement: "Add estimated effort, owner, and decision deadline for each action." },
    { id: "communication", label: "Communication", score: 84, task: "stakeholderUpdate", quote: "Track signup-to-activation conversion as the success metric.", rationale: "Gives the product lead a concise finding, next action, and measurable outcome.", improvement: "Set an explicit experiment duration and a baseline before defining a target." },
  ],
};

export const sampleOverallScore = Math.round(sampleReport.skills.reduce((sum, skill) => sum + skill.score, 0) / sampleReport.skills.length);
