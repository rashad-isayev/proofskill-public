// Public API contracts are shared with Developer 1. Persisted records are private.
import {
  blueprintSchema,
  reportSchema,
  candidateViewSchema,
  type Blueprint as PublicBlueprint,
} from "@/lib/contracts";
import {
  BlueprintSchema,
  type Blueprint,
  type Assessment,
  type Message,
} from "./internal-contracts";
import type { CandidateSession } from "./validation";
import type { assessmentDetails, getReport, dashboard } from "./store";
export function publicBlueprint(b: Blueprint): PublicBlueprint {
  return blueprintSchema.parse({
    roleTitle: b.title,
    seniority: b.seniority,
    description: b.description,
    durationMinutes: b.durationMinutes,
    environment: {
      description: b.environment,
      tools: b.tools,
      dataTypes: b.dataTypes,
    },
    competencies: b.competencies,
    expectedEvidence: b.strongEvidence,
    constraints: b.constraints,
    scenarioFamilies: b.families.map((f) => ({
      id: f.id,
      name: f.name ?? f.archetype,
      archetype: f.archetype,
      difficulty: {
        hiddenFactCount: f.difficulty.hiddenFacts,
        complicationCount: f.difficulty.complications,
        ambiguity: f.difficulty.ambiguity,
      },
      numericRanges: Object.fromEntries(
        Object.entries(f.ranges).map(([k, v]) => [k, { min: v[0], max: v[1] }]),
      ),
      competencyIds: f.competencyIds,
    })),
  });
}
export function persistedBlueprint(b: PublicBlueprint): Blueprint {
  return BlueprintSchema.parse({
    title: b.roleTitle,
    seniority: b.seniority,
    description: b.description,
    durationMinutes: b.durationMinutes,
    environment: b.environment.description,
    tools: b.environment.tools,
    dataTypes: b.environment.dataTypes,
    competencies: b.competencies,
    strongEvidence: b.expectedEvidence,
    constraints: b.constraints,
    families: b.scenarioFamilies.map((f) => ({
      id: f.id,
      name: f.name,
      archetype: f.archetype,
      difficulty: {
        hiddenFacts: f.difficulty.hiddenFactCount,
        complications: f.difficulty.complicationCount,
        ambiguity: f.difficulty.ambiguity,
      },
      ranges: Object.fromEntries(
        Object.entries(f.numericRanges).map(([k, v]) => [k, [v.min, v.max]]),
      ),
      competencyIds: f.competencyIds,
    })),
  });
}
export const publicAssessment = (a: Assessment) => ({
  ...a,
  blueprint: publicBlueprint(a.blueprint),
});
export function publicDetails(
  d: Awaited<ReturnType<typeof assessmentDetails>>,
) {
  return {
    assessment: publicAssessment(d.assessment),
    invites: d.candidates.map((c) => ({
      ...c,
      token: "unavailable",
      assessmentVersion: d.assessment.version,
      status: c.status === "in progress" ? "in-progress" : c.status,
    })),
  };
}
const publicMessage = (m: Message) => ({
  id: m.id,
  role: m.role,
  content: m.text,
  createdAt: m.createdAt,
  turn: m.turn,
});
export function publicCandidate(s: CandidateSession) {
  return candidateViewSchema.parse({
    id: s.id,
    demo: s.demo,
    roleTitle: s.world.role,
    // The stored name carries a seed-derived suffix for uniqueness; candidates see the plain name.
    companyName: s.world.company.replace(/ · [A-Za-z]{6}$/, ""),
    companyContext: s.world.context,
    candidateRole: s.world.role,
    startedAt: s.startedAt,
    deadlineAt: s.deadline,
    maxTurns: 6,
    turnsCompleted: s.turns,
    status:
      s.status === "active"
        ? "in-progress"
        : s.status === "ready"
          ? "ready-to-complete"
          : "completed",
    draft: s.draft,
    facts: s.world.facts,
    documents: s.world.tools.map((tool, i) => ({
      id: "tool-" + i,
      title: tool,
      content: "Available workplace tool",
    })),
    messages: s.messages.map(publicMessage),
    revealedInfo: s.revealedInfo.map((x, i) => ({
      ...x,
      id: "reveal-" + i,
      revealedAt: s.revealedDates[i] ?? s.startedAt,
    })),
    events: s.world.events.map((title, i) => ({
      id: "event-" + i,
      title,
      createdAt: s.eventMetadata[i]?.createdAt ?? s.startedAt,
    })),
  });
}
export function publicReport(d: Awaited<ReturnType<typeof getReport>>) {
  const { report: r, session: s, candidate: c } = d;
  return reportSchema.parse({
    id: r.id,
    assessmentId: s.assessmentId,
    assessmentVersion: s.assessmentVersion,
    candidateName: c.candidateName,
    roleTitle: s.blueprint.title,
    durationSeconds: Math.max(
      0,
      Math.round(
        (Date.parse(s.completedAt ?? r.createdAt) - Date.parse(s.startedAt)) /
          1000,
      ),
    ),
    createdAt: r.createdAt,
    demo: r.demo,
    blueprint: publicBlueprint(s.blueprint),
    competencies: r.ratings.map((x) => ({
      competencyId: x.competencyId,
      score: x.score,
      sufficiency: x.sufficiency === "supported" ? "adequate" : x.sufficiency,
      rationale: x.rationale,
      evidence: x.quotes.map((quote) => {
        const m = s.messages.find(
          (m) => m.role === "candidate" && m.text.includes(quote),
        )!;
        return {
          competencyId: x.competencyId,
          quote,
          note:
            s.evidence.find(
              (e) => e.competencyId === x.competencyId && e.quote === quote,
            )?.note ?? x.rationale,
          messageId: m.id,
        };
      }),
    })),
    strengths: r.strengths,
    weaknesses: r.weaknesses,
    reasoningMistakes: r.reasoningMistakes,
    contradictions: r.contradictions,
    untestedCompetencies: r.untestedCompetencies,
    uncertainty: r.uncertainty,
    followUpTopics: r.followUpTopics,
    overallWeightedScore: r.overallScore,
    coveragePercent: r.coverage,
    messages: s.messages.map(publicMessage),
    reviewerNotes: r.notes,
    reviewed: r.reviewed,
    humanDecision: r.decision,
  });
}
export function publicDashboard(d: Awaited<ReturnType<typeof dashboard>>) {
  return {
    counts: d.counts,
    demo: d.assessments.some((a) => a.demo),
    activity: d.activity.map((a) => ({
      id: a.id,
      title: a.text,
      createdAt: a.time,
      demo: a.demo,
      assessmentId:
        d.assessments.find((x) => x.id === a.id)?.id ??
        d.candidates.find((x) => x.id === a.id)?.assessmentId ??
        null,
    })),
  };
}
