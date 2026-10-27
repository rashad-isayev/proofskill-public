import { z } from "zod";
import { monitoringPolicySchema } from "./b2b/monitoring-contract";

const id = z.string().min(1).max(160);
const text = z.string().min(1).max(12000);
const iso = z.string().datetime();
export const competencySchema = z.object({
  id,
  name: z.string().min(1).max(120),
  definition: text,
  weight: z.number().min(0.01).max(1),
  indicators: z.array(text).min(1).max(12),
  rubric: z.object({ "1": text, "2": text, "3": text, "4": text, "5": text }),
});
export const scenarioFamilySchema = z.object({
  id,
  name: z.string().min(1).max(160),
  archetype: text,
  difficulty: z.object({
    hiddenFactCount: z.number().int().min(1).max(20),
    complicationCount: z.number().int().min(0).max(10),
    ambiguity: z.enum(["low", "medium", "high"]),
  }),
  numericRanges: z.record(
    z.string(),
    z
      .object({ min: z.number(), max: z.number() })
      .refine((r) => r.max >= r.min, "Maximum must be at least minimum."),
  ),
  competencyIds: z.array(id).min(1),
});
export const blueprintSchema = z
  .object({
    roleTitle: z.string().min(2).max(160),
    seniority: z.string().min(1).max(80),
    description: text,
    durationMinutes: z.number().int().min(5).max(120),
    environment: z.object({
      description: text,
      tools: z.array(text),
      dataTypes: z.array(text),
    }),
    competencies: z.array(competencySchema).min(4).max(5),
    expectedEvidence: z.array(text).min(1),
    constraints: z.array(text),
    scenarioFamilies: z.array(scenarioFamilySchema).min(2).max(3),
  })
  .superRefine((b, ctx) => {
    const ids = new Set(b.competencies.map((c) => c.id));
    if (ids.size !== b.competencies.length)
      ctx.addIssue({
        code: "custom",
        message: "Competency IDs must be unique.",
      });
    if (
      Math.abs(b.competencies.reduce((s, c) => s + c.weight, 0) - 1) > 0.000001
    )
      ctx.addIssue({
        code: "custom",
        message: "Competency weights must sum to 100%.",
      });
    if (
      new Set(b.scenarioFamilies.map((f) => f.id)).size !==
      b.scenarioFamilies.length
    )
      ctx.addIssue({ code: "custom", message: "Family IDs must be unique." });
    if (
      b.scenarioFamilies.some((f) =>
        f.competencyIds.some((cid) => !ids.has(cid)),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Families must target defined competencies.",
      });
    const first = b.scenarioFamilies[0].difficulty;
    if (
      b.scenarioFamilies.some(
        (f) =>
          f.difficulty.hiddenFactCount !== first.hiddenFactCount ||
          f.difficulty.complicationCount !== first.complicationCount ||
          f.difficulty.ambiguity !== first.ambiguity,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Scenario families must share difficulty parameters.",
      });
  });
export const assessmentSchema = z.object({
  monitoring: monitoringPolicySchema.optional(),
  id,
  version: z.number().int().min(1),
  status: z.enum(["draft", "published", "closed"]),
  blueprint: blueprintSchema,
  createdAt: iso,
  publishedAt: iso.nullable(),
  demo: z.boolean(),
});
export const inviteSchema = z.object({
  id,
  assessmentId: id,
  assessmentVersion: z.number().int().min(1),
  sessionId: id.nullable().optional(),
  token: id,
  candidateName: z.string().min(1).max(100),
  candidateEmail: z.string().email(),
  status: z.enum([
    "invited",
    "in-progress",
    "completed",
    "reviewed",
    "archived",
  ]),
  startedAt: iso.nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  reportId: id.nullable(),
  demo: z.boolean(),
});
export const messageSchema = z.object({
  id,
  role: z.enum(["manager", "candidate"]),
  content: text,
  createdAt: iso,
  turn: z.number().int().min(0).max(6),
});
export const worldSchema = z.object({
  facts: z.record(z.string(), z.union([z.string(), z.number()])),
  hiddenFacts: z.record(z.string(), z.union([z.string(), z.number()])),
  events: z.array(z.object({ id, title: text, createdAt: iso })),
});
export const evidenceSchema = z.object({
  competencyId: id,
  quote: text,
  note: text,
  messageId: id,
});
export const turnResultSchema = z.object({
  reply: text,
  revealedInfo: z
    .array(
      z.object({
        title: text,
        data: z.record(z.string(), z.union([z.string(), z.number()])),
      }),
    )
    .optional(),
  newEvents: z.array(text).optional(),
  evidence: z.array(z.object({ competencyId: id, quote: text, note: text })),
  nextObjective: text,
  shouldEnd: z.boolean(),
});
export const sessionSchema = z.object({
  id,
  inviteId: id,
  assessmentId: id,
  assessmentVersion: z.number().int().min(1),
  seed: id,
  familyId: id,
  world: worldSchema,
  messages: z.array(messageSchema),
  evidence: z.array(evidenceSchema),
  nextObjective: text,
  startedAt: iso,
  deadlineAt: iso,
  status: z.enum(["in-progress", "ready-to-complete", "completed"]),
});
export const competencyEvidenceSchema = z
  .object({
    competencyId: id,
    score: z.number().int().min(1).max(5).nullable(),
    sufficiency: z.enum(["insufficient", "limited", "adequate", "strong"]),
    rationale: text,
    evidence: z.array(evidenceSchema),
  })
  .refine(
    (c) =>
      c.score === null
        ? c.sufficiency === "insufficient"
        : c.evidence.length > 0 && c.sufficiency !== "insufficient",
    "Missing evidence must have a null score.",
  );
export const humanDecisionSchema = z.enum([
  "undecided",
  "advance",
  "hold",
  "decline",
]);
export const reportSchema = z
  .object({
    id,
    assessmentId: id,
    assessmentVersion: z.number().int().min(1),
    candidateName: text,
    roleTitle: text,
    durationSeconds: z.number().int().nonnegative(),
    createdAt: iso,
    demo: z.boolean(),
    blueprint: blueprintSchema,
    competencies: z.array(competencyEvidenceSchema).min(4).max(5),
    strengths: z.array(text),
    weaknesses: z.array(text),
    reasoningMistakes: z.array(text),
    contradictions: z.array(text),
    untestedCompetencies: z.array(id),
    uncertainty: z.enum(["low", "medium", "high"]),
    followUpTopics: z.array(text),
    overallWeightedScore: z.number().min(1).max(5).nullable(),
    coveragePercent: z.number().min(0).max(100),
    messages: z.array(messageSchema),
    reviewerNotes: z.string().max(10000),
    reviewed: z.boolean(),
    humanDecision: humanDecisionSchema,
  })
  .superRefine((r, ctx) => {
    const ids = new Set(r.competencies.map((c) => c.competencyId));
    if (
      ids.size !== r.competencies.length ||
      r.competencies.length !== r.blueprint.competencies.length ||
      r.blueprint.competencies.some((c) => !ids.has(c.id))
    )
      ctx.addIssue({
        code: "custom",
        message: "Report must cover the locked competency set.",
      });
    for (const c of r.competencies)
      for (const e of c.evidence) {
        const m = r.messages.find(
          (m) => m.id === e.messageId && m.role === "candidate",
        );
        if (e.competencyId !== c.competencyId || !m?.content.includes(e.quote))
          ctx.addIssue({
            code: "custom",
            message:
              "Evidence quote must occur verbatim in the referenced candidate message.",
          });
      }
    const total = r.blueprint.competencies.reduce((s, c) => {
      const score = r.competencies.find((e) => e.competencyId === c.id)?.score;
      return s + (score != null ? c.weight : 0);
    }, 0);
    const weighted = total
      ? r.blueprint.competencies.reduce((s, c) => {
          const score = r.competencies.find(
            (e) => e.competencyId === c.id,
          )?.score;
          return s + (score != null ? score * c.weight : 0);
        }, 0) / total
      : null;
    if (
      Math.abs(r.coveragePercent - total * 100) > 0.01 ||
      (weighted === null
        ? r.overallWeightedScore !== null
        : r.overallWeightedScore === null ||
          Math.abs(r.overallWeightedScore - weighted) > 0.011)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Weighted score/coverage must match scored competency weights.",
      });
  });
const publicMessage = messageSchema.strict();
const revealed = z
  .object({
    id,
    title: text,
    data: z.record(z.string(), z.union([z.string(), z.number()])),
    revealedAt: iso,
  })
  .strict();
export const candidateViewSchema = z
  .object({
    demo: z.boolean(),
    id,
    roleTitle: text,
    companyName: text,
    companyContext: text,
    candidateRole: text,
    startedAt: iso,
    deadlineAt: iso,
    maxTurns: z.literal(6),
    turnsCompleted: z.number().int().min(0).max(6),
    draft: z.string().max(4000).optional(),
    status: z.enum(["in-progress", "ready-to-complete", "completed"]),
    facts: z.record(z.string(), z.union([z.string(), z.number()])),
    documents: z.array(z.object({ id, title: text, content: text }).strict()),
    messages: z.array(publicMessage),
    revealedInfo: z.array(revealed),
    events: z.array(z.object({ id, title: text, createdAt: iso }).strict()),
  })
  .strict();
export const inviteEntrySchema = z
  .object({
    demo: z.boolean(),
    roleTitle: text,
    durationMinutes: z.number().int().min(5).max(120),
    status: z.enum([
      "invited",
      "in-progress",
      "completed",
      "reviewed",
      "archived",
    ]),
    sessionId: id.nullable(),
  })
  .strict()
  .refine(
    (e) => e.status !== "in-progress" || e.sessionId !== null,
    "In-progress invitations require a persisted session.",
  );
export const dashboardSchema = z.object({
  counts: z.object({
    activePositions: z.number().int().nonnegative(),
    publishedAssessments: z.number().int().nonnegative(),
    invitedCandidates: z.number().int().nonnegative(),
    completedSimulations: z.number().int().nonnegative(),
    awaitingReview: z.number().int().nonnegative(),
  }),
  activity: z.array(
    z.object({
      id,
      title: text,
      createdAt: iso,
      demo: z.boolean(),
      assessmentId: id.nullable(),
    }),
  ),
  demo: z.boolean(),
});
export const assessmentDetailSchema = z.object({
  assessment: assessmentSchema,
  invites: z.array(inviteSchema),
});
export type Blueprint = z.infer<typeof blueprintSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Competency = z.infer<typeof competencySchema>;
export type ScenarioFamily = z.infer<typeof scenarioFamilySchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type World = z.infer<typeof worldSchema>;
export type Message = z.infer<typeof messageSchema>;
export type CompetencyEvidence = z.infer<typeof competencyEvidenceSchema>;
export type TurnResult = z.infer<typeof turnResultSchema>;
export type Report = z.infer<typeof reportSchema>;
export type CandidateView = z.infer<typeof candidateViewSchema>;
