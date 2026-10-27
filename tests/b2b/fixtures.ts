import type {
  Blueprint,
  Assessment,
  Invite,
  Report,
  CandidateView,
} from "../../lib/contracts";
export const date = "2026-10-09T12:00:00.000Z";
export const blueprint: Blueprint = {
  roleTitle: "Junior Digital Marketing Specialist",
  seniority: "Junior",
  description:
    "Diagnose campaign performance and recommend evidence-based next steps.",
  durationMinutes: 15,
  environment: {
    description: "A fictional subscription company’s marketing operations.",
    tools: ["Campaign dashboard", "Analytics report"],
    dataTypes: ["Spend", "Clicks", "Conversions"],
  },
  competencies: [
    "Analytical reasoning",
    "Problem diagnosis",
    "Prioritization",
    "Communication",
  ].map((name, i) => ({
    id: "c" + i,
    name,
    definition:
      "Demonstrate " +
      name.toLowerCase() +
      " through observable workplace decisions.",
    weight: 0.25,
    indicators: ["Explain decisions using the supplied evidence."],
    rubric: {
      "1": "Unsupported conclusion.",
      "2": "Partial reasoning.",
      "3": "Coherent approach.",
      "4": "Evidence-based trade-offs.",
      "5": "Comprehensive, calibrated reasoning.",
    },
  })),
  expectedEvidence: [
    "Explain a diagnostic plan and calculate relevant metrics.",
  ],
  constraints: ["Do not change historical company facts."],
  scenarioFamilies: ["Conversion drop", "Rising acquisition cost"].map(
    (name, i) => ({
      id: "f" + i,
      name,
      archetype: "Investigate " + name.toLowerCase() + ".",
      difficulty: {
        hiddenFactCount: 2,
        complicationCount: 1,
        ambiguity: "medium",
      },
      numericRanges: { spend: { min: 1000, max: 3000 } },
      competencyIds: ["c0", "c1", "c2", "c3"],
    }),
  ),
};
export const assessment: Assessment = {
  id: "a1",
  version: 1,
  status: "published",
  blueprint,
  createdAt: date,
  publishedAt: date,
  demo: true,
};
export const invite: Invite = {
  id: "i1",
  assessmentId: "a1",
  assessmentVersion: 1,
  token: "private-token",
  candidateName: "Demo Alex",
  candidateEmail: "alex@example.test",
  status: "completed",
  startedAt: date,
  durationSeconds: 780,
  reportId: "r1",
  demo: true,
};
export const report: Report = {
  id: "r1",
  assessmentId: "a1",
  assessmentVersion: 1,
  candidateName: invite.candidateName,
  roleTitle: blueprint.roleTitle,
  durationSeconds: 780,
  createdAt: date,
  demo: true,
  blueprint,
  competencies: blueprint.competencies.map((c, i) => ({
    competencyId: c.id,
    score: i === 3 ? null : [4, 3, 4][i],
    sufficiency: i === 3 ? "insufficient" : "adequate",
    rationale:
      i === 3
        ? "No communication evidence was elicited."
        : "The response explains a concrete diagnostic step.",
    evidence:
      i === 3
        ? []
        : [
            {
              competencyId: c.id,
              quote: "I would compare conversion rates by device.",
              note: "A testable segmentation plan.",
              messageId: "m1",
            },
          ],
  })),
  strengths: ["Uses segmentation."],
  weaknesses: ["Limited coverage."],
  reasoningMistakes: [],
  contradictions: [],
  untestedCompetencies: ["c3"],
  uncertainty: "medium",
  followUpTopics: ["Ask how the plan would be communicated."],
  overallWeightedScore: 3.67,
  coveragePercent: 75,
  messages: [
    {
      id: "m0",
      role: "manager",
      content: "How would you investigate the conversion drop?",
      createdAt: date,
      turn: 0,
    },
    {
      id: "m1",
      role: "candidate",
      content:
        "I would compare conversion rates by device. Then inspect tracking changes.",
      createdAt: "2026-10-09T12:01:00.000Z",
      turn: 1,
    },
  ],
  reviewerNotes: "",
  reviewed: false,
  humanDecision: "undecided",
};
export function candidate(): CandidateView {
  const start = new Date();
  return {
    id: "s1",
    demo: true,
    roleTitle: blueprint.roleTitle,
    companyName: "Northstar — fictional workplace",
    companyContext: "A subscription business preparing its next campaign.",
    candidateRole: "You are assisting the marketing manager.",
    startedAt: start.toISOString(),
    deadlineAt: new Date(start.getTime() + 900000).toISOString(),
    maxTurns: 6,
    turnsCompleted: 0,
    status: "in-progress",
    facts: { spend: 2000, clicks: 1000, conversions: 40 },
    documents: [
      {
        id: "d1",
        title: "Campaign brief",
        content: "Prioritize diagnostics before expanding campaign spend.",
      },
    ],
    messages: [
      {
        id: "manager1",
        role: "manager",
        content:
          "Conversions fell this week. What would you investigate first, and why?",
        createdAt: start.toISOString(),
        turn: 0,
      },
    ],
    revealedInfo: [],
    events: [],
  };
}
