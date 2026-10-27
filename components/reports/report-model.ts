import { z } from "zod";

// Validated report-view schemas used by the frontend adapter.
export const skillIds = [
  "analytical-thinking",
  "problem-solving",
  "prioritization",
  "communication",
] as const;
export const taskIds = [
  "analysis",
  "recommendations",
  "stakeholderUpdate",
] as const;
export const skillLabels: Record<(typeof skillIds)[number], string> = {
  "analytical-thinking": "Analytical thinking",
  "problem-solving": "Problem solving",
  prioritization: "Prioritization",
  communication: "Communication",
};
export const taskLabels: Record<(typeof taskIds)[number], string> = {
  analysis: "Funnel analysis",
  recommendations: "Recommendations",
  stakeholderUpdate: "Stakeholder update",
};
export const taskInstructions = {
  analysis:
    "Analyze the funnel. Identify the main drop-off, support your conclusion with numbers, and explain what the data cannot tell you yet.",
  recommendations:
    "Recommend two actions. Explain which one should come first and why. State an uncertainty that could change your recommendation.",
  stakeholderUpdate:
    "Write a concise update to the product lead. Include the key finding, your next step, and a metric that will tell the team whether the response works.",
};

const responseSchema = z.string().min(1).max(6000);
const submissionSchema = z.object({
  scenarioId: z.literal("product-launch"),
  rubricVersion: z.string().min(1).max(100),
  responses: z.object({
    analysis: responseSchema,
    recommendations: responseSchema,
    stakeholderUpdate: responseSchema,
  }),
});

export const frontendReportSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    createdAt: z.string().datetime({ offset: true }),
    scenarioId: z.literal("product-launch"),
    rubricVersion: z.string().min(1).max(100),
    mode: z.enum(["ai", "demo"]),
    submission: submissionSchema,
    overallScore: z.number().int().min(0).max(100),
    skills: z
      .array(
        z.object({
          skillId: z.enum(skillIds),
          score: z.number().int().min(0).max(100),
          rationale: z.string().min(1).max(4000),
          evidence: z
            .array(
              z.object({
                taskId: z.enum(taskIds),
                quote: z.string().min(1).max(6000),
                explanation: z.string().min(1).max(4000),
              }),
            )
            .min(1)
            .max(10),
          improvement: z.string().min(1).max(4000),
        }),
      )
      .length(4),
    strengths: z.array(z.string().min(1).max(2000)).max(20),
    nextSteps: z.array(z.string().min(1).max(2000)).max(20),
    limitations: z.array(z.string().min(1).max(2000)).max(20),
  })
  .superRefine((report, context) => {
    if (new Set(report.skills.map((skill) => skill.skillId)).size !== 4) {
      context.addIssue({
        code: "custom",
        message: "Every assessed skill must appear exactly once.",
      });
    }
    if (
      report.overallScore !==
      Math.round(report.skills.reduce((sum, skill) => sum + skill.score, 0) / 4)
    ) {
      context.addIssue({
        code: "custom",
        message: "Overall score must match the equal-weight skill average.",
      });
    }
    if (
      report.submission.scenarioId !== report.scenarioId ||
      report.submission.rubricVersion !== report.rubricVersion
    ) {
      context.addIssue({
        code: "custom",
        message: "Report and submission must use the same scenario and rubric.",
      });
    }
    for (const skill of report.skills) {
      for (const evidence of skill.evidence) {
        if (
          !report.submission.responses[evidence.taskId].includes(evidence.quote)
        ) {
          context.addIssue({
            code: "custom",
            message:
              "An evidence quote is missing from the submitted response.",
          });
        }
      }
    }
  });

export type AssessmentReport = z.infer<typeof frontendReportSchema>;
export type SkillAssessment = AssessmentReport["skills"][number];
export type ReportSource = "sample" | "assessment" | "imported";
export type ReportRecord = { report: AssessmentReport; source: ReportSource };
export const reviewSchema = z.object({
  status: z.enum(["unreviewed", "reviewed", "needs-follow-up"]),
  note: z.string().max(3000),
});
export type Review = z.infer<typeof reviewSchema>;
export const emptyReview: Review = { status: "unreviewed", note: "" };

export function scoreDescription(score: number) {
  if (score >= 75) return "Strong demonstration";
  if (score >= 50) return "Competent demonstration";
  if (score >= 25) return "Partial demonstration";
  return "Insufficient evidence";
}
