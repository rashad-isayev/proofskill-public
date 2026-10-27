import { randomUUID } from "node:crypto";
import {
  type Blueprint,
  type Session,
  type Report,
  type Assessment,
} from "@/lib/hiring/internal-contracts";
import {
  validateBlueprint,
  seededNumbers,
  weightedScore,
} from "../../lib/hiring/validation";
export const demoBlueprint: Blueprint = validateBlueprint({
  title: "Junior Digital Marketing Specialist",
  seniority: "Junior",
  description:
    "Investigate a business performance change, choose an evidence-based response, and communicate tradeoffs to stakeholders.",
  durationMinutes: 15,
  environment: "Fictional commerce and subscription workplaces",
  tools: [
    "Analytics dashboard",
    "Campaign ledger",
    "Release log",
    "Stakeholder messages",
  ],
  dataTypes: ["Funnel metrics", "Spend and revenue", "Investigation notes"],
  strongEvidence: [
    "Separate observations from causal assumptions",
    "Use relevant source data",
    "Prioritize a measurable response",
  ],
  constraints: [
    "No budget increase without supporting evidence",
    "Treat causal explanations as hypotheses",
    "Keep decisions within the existing data",
  ],
  competencies: [
    {
      id: "analysis",
      name: "Evidence analysis",
      definition:
        "Interpret relevant data and distinguish observation from assumption.",
      weight: 0.3,
      indicators: [
        "Requests diagnostic information",
        "Cites a relevant metric",
      ],
      rubric: {
        "1": "Uses unsupported conclusions despite available evidence.",
        "2": "Names a symptom with limited interpretation.",
        "3": "Links observations to a reasonable hypothesis.",
        "4": "Tests alternatives with relevant evidence.",
        "5": "Integrates evidence, uncertainty and a discriminating test.",
      },
    },
    {
      id: "judgment",
      name: "Decision judgment",
      definition: "Choose actions proportional to evidence and constraints.",
      weight: 0.3,
      indicators: ["Prioritizes reversible actions", "Explains tradeoffs"],
      rubric: {
        "1": "Proposes actions inconsistent with constraints.",
        "2": "Proposes an action with weak justification.",
        "3": "Justifies a feasible action and priority.",
        "4": "Compares alternatives and risks.",
        "5": "Makes a defensible staged decision with contingency plans.",
      },
    },
    {
      id: "communication",
      name: "Stakeholder communication",
      definition: "Explain the decision clearly to a workplace stakeholder.",
      weight: 0.2,
      indicators: [
        "Connects action and rationale",
        "Names a measurable next step",
      ],
      rubric: {
        "1": "Unclear or unsupported stakeholder update.",
        "2": "States a plan without rationale.",
        "3": "Communicates action, rationale and next step.",
        "4": "Adapts the explanation and makes assumptions explicit.",
        "5": "Gives a concise decision-ready account with tradeoffs and checkpoints.",
      },
    },
    {
      id: "adaptation",
      name: "Adaptive reasoning",
      definition: "Update a plan when new information or constraints arrive.",
      weight: 0.2,
      indicators: [
        "Revises a hypothesis",
        "Explains implications of new information",
      ],
      rubric: {
        "1": "Ignores relevant changes.",
        "2": "Acknowledges change without revising the plan.",
        "3": "Updates the plan based on the new evidence.",
        "4": "Explains how the evidence changes priorities.",
        "5": "Reconciles conflicting observations and redesigns the test.",
      },
    },
  ],
  families: [
    "Conversion drop with a hidden checkout bug",
    "Rising CAC caused by channel mix",
  ].map((archetype, i) => ({
    id: `family-${i + 1}`,
    archetype,
    difficulty: {
      hiddenFacts: 2,
      complications: 2,
      ambiguity: "medium" as const,
    },
    ranges: {
      visitors: [10000, 30000] as [number, number],
      conversionBps: [150, 400] as [number, number],
      spend: [5000, 15000] as [number, number],
      orderValue: [50, 150] as [number, number],
    },
    competencyIds: ["analysis", "judgment", "communication", "adaptation"],
  })),
});
export function demoRecords(ownerId: string) {
  const at = new Date().toISOString(),
    id = randomUUID();
  const assessment: Assessment = {
    id,
    lineageId: id,
    ownerId,
    version: 1,
    status: "published",
    blueprint: demoBlueprint,
    createdAt: at,
    publishedAt: at,
    demo: true,
  };
  return {
    assessment,
    candidates: ["A", "B"].map((label, i) => {
      const sessionId = randomUUID(),
        inviteId = randomUUID(),
        reportId = randomUUID();
      const seed = `demo-${label}`;
      const messages = [
        [
          "manager",
          "Please investigate the performance change and recommend a next step.",
        ],
        [
          "candidate",
          i === 0
            ? "I would reconcile analytics and inspect the checkout release before spending more."
            : "I would inspect acquisition channel mix before concluding the campaign became less efficient.",
        ],
        [
          "manager",
          "What evidence would distinguish your hypothesis from an alternative?",
        ],
        [
          "candidate",
          "I will compare cohorts and check the tracking ledger. The observed change alone does not prove causality.",
        ],
        [
          "manager",
          "Finance needs a plan within the existing budget. How do you prioritize?",
        ],
        [
          "candidate",
          "First validate the measurement, then run a reversible test. Keep the budget unchanged until we know the cause.",
        ],
        ["manager", "Explain the plan to the product lead."],
        [
          "candidate",
          "We should validate tracking, isolate the suspected issue, and review the result before expanding spend. The next checkpoint is the investigation report.",
        ],
      ].map(([role, text], idx) => ({
        id: randomUUID(),
        role: role as "manager" | "candidate",
        text,
        createdAt: at,
        turn: Math.ceil(idx / 2),
      }));
      const evidence = [
        {
          competencyId: "analysis",
          quote: messages[1].text,
          note: "Requests diagnostic evidence before a causal conclusion.",
          turn: 1,
        },
        {
          competencyId: "judgment",
          quote: messages[5].text,
          note: "Prioritizes a reversible action under the budget constraint.",
          turn: 3,
        },
        {
          competencyId: "communication",
          quote: messages[7].text,
          note: "Communicates the plan and next checkpoint.",
          turn: 4,
        },
      ];
      const session: Session = {
        id: sessionId,
        inviteId,
        assessmentId: id,
        assessmentVersion: 1,
        blueprint: demoBlueprint,
        seed,
        familyId: demoBlueprint.families[i].id,
        world: {
          company:
            i === 0 ? "Demo · Alder Commerce" : "Demo · Meridian Subscription",
          role: demoBlueprint.title,
          context:
            i === 0
              ? "A fictional e-commerce team is investigating a conversion drop."
              : "A fictional subscription team is investigating rising acquisition cost.",
          facts: seededNumbers(seed, demoBlueprint.families[i]),
          hiddenFacts: {
            tracking: "Tracking reconciliation has not been completed.",
          },
          events: ["Finance requests a plan within the existing budget."],
          tools: demoBlueprint.tools,
        },
        messages,
        evidence,
        revealedInfo: [],
        nextObjective: "adaptation",
        draft: "",
        requests: [],
        turns: 4,
        status: "completed",
        startedAt: new Date(Date.parse(at) - 300000).toISOString(),
        deadline: new Date(Date.parse(at) + 600000).toISOString(),
        completedAt: at,
        reportId,
        demo: true,
      };
      const evaluation = {
        ratings: demoBlueprint.competencies.map((c, j) => ({
          competencyId: c.id,
          score: j === 3 ? null : i === 0 ? 4 : 3,
          quotes: evidence
            .filter((e) => e.competencyId === c.id)
            .map((e) => e.quote),
          sufficiency:
            j === 3 ? ("insufficient" as const) : ("supported" as const),
          rationale:
            j === 3
              ? "The fictional transcript did not probe adaptation."
              : "Illustrative assessment of the labeled fictional responses against the rubric.",
        })),
        strengths: ["Distinguishes causal hypotheses from observations."],
        weaknesses: [
          "The proposed investigation needs a more specific measurement window.",
        ],
        reasoningMistakes: [],
        contradictions: [],
        followUpTopics: [
          "Ask how the plan would change if diagnostic evidence contradicts the hypothesis.",
        ],
        uncertainty: "high" as const,
      };
      const report: Report = {
        ...evaluation,
        ...weightedScore(evaluation, demoBlueprint),
        id: reportId,
        sessionId,
        assessmentId: id,
        notes: "",
        reviewed: false,
        decision: "undecided",
        createdAt: at,
        demo: true,
      };
      const invite = {
        id: inviteId,
        assessmentId: id,
        candidateName: `Demo Candidate ${label}`,
        candidateEmail: `demo-${label.toLowerCase()}@example.test`,
        status: "completed",
        createdAt: session.startedAt,
        sessionId,
        demo: true,
      };
      return { session, report, invite };
    }),
  };
}
