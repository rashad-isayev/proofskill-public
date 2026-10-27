import { sampleReport } from "@/components/reports/sample-data";
import {
  frontendReportSchema,
  type ReportRecord,
} from "@/components/reports/report-model";

const responses = sampleReport.responses;
const skills = sampleReport.skills.map((skill) => ({
  skillId: skill.id,
  score: skill.score,
  rationale: skill.rationale,
  evidence: [
    { taskId: skill.task, quote: skill.quote, explanation: skill.rationale },
  ],
  improvement: skill.improvement,
}));

export const sampleRecord: ReportRecord = {
  source: "sample",
  report: frontendReportSchema.parse({
    id: "sample",
    createdAt: "2026-10-01T12:00:00Z",
    scenarioId: "product-launch",
    rubricVersion: "draft-1",
    mode: "demo",
    submission: {
      scenarioId: "product-launch",
      rubricVersion: "draft-1",
      responses,
    },
    overallScore: Math.round(
      skills.reduce((sum, skill) => sum + skill.score, 0) / 4,
    ),
    skills,
    strengths: [
      "Uses a correct numerical calculation to identify the activation bottleneck.",
      "Separates observations from an unconfirmed cause.",
      "Communicates a concrete next action and success metric.",
    ],
    nextSteps: skills.map((skill) => skill.improvement),
    limitations: [
      "Fictional sample responses and illustrative scores; no live AI evaluation was performed.",
      "This exercise covers a narrow set of tasks and does not establish overall job readiness.",
      "No identity verification or scientific validation is provided. Human review remains essential.",
    ],
  }),
};

const alternateResponses = {
  analysis:
    "Activation is low: 1,800 of 6,000 signups activate, or 30%. The funnel alone cannot establish why. I would compare device cohorts and the previous release before changing onboarding.",
  recommendations:
    "First, check device-level errors with an engineer today; this is a low-effort way to find a possible regression. Second, run a one-week onboarding experiment with the product designer. A technical error would change which action comes first.",
  stakeholderUpdate:
    "Maya, only 30% of signups activate. We should investigate device-level errors today before choosing a redesign. If no regression is found, test a shorter flow for one week, measuring signup-to-activation conversion alongside return rate.",
};
const alternateScores = [78, 84, 88, 76];
const alternateQuotes = [
  "1,800 of 6,000 signups activate, or 30%.",
  "First, check device-level errors with an engineer today",
  "this is a low-effort way to find a possible regression.",
  "measuring signup-to-activation conversion alongside return rate.",
];
const alternateRationales = [
  "Calculates activation accurately and names a comparison that would improve diagnosis.",
  "Proposes investigation and a time-bound experiment with identifiable owners.",
  "Explains effort, timing, and a condition that would change the order of work.",
  "Gives a clear plan and metrics, but could make the requested decision more explicit.",
];
const alternateSkills = skills.map((skill, index) => ({
  ...skill,
  score: alternateScores[index],
  rationale: alternateRationales[index],
  evidence: [
    {
      taskId: skill.evidence[0].taskId,
      quote: alternateQuotes[index],
      explanation: alternateRationales[index],
    },
  ],
}));

export const comparisonRecord: ReportRecord = {
  source: "sample",
  report: frontendReportSchema.parse({
    ...sampleRecord.report,
    id: "sample-alternate",
    submission: {
      ...sampleRecord.report.submission,
      responses: alternateResponses,
    },
    skills: alternateSkills,
    overallScore: Math.round(
      alternateScores.reduce((sum, score) => sum + score, 0) / 4,
    ),
    strengths: [
      "Assigns owners and time frames to proposed actions.",
      "Balances experiment success with a return-rate guardrail.",
    ],
    nextSteps: [
      "Make the stakeholder's requested decision explicit.",
      "Compare drop-offs across all funnel stages before selecting the bottleneck.",
    ],
  }),
};

export const sampleRecords = [sampleRecord, comparisonRecord];
