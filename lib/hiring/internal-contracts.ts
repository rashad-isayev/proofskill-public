import { z } from "zod";
import { monitoringPolicySchema } from "@/lib/b2b/monitoring-contract";
const text = z.string().trim().min(1).max(4000);
const id = z.string().min(1).max(100);
export const CompetencySchema = z
  .object({
    id,
    name: text,
    definition: text,
    weight: z.number().positive().max(1),
    indicators: z.array(text).min(1).max(8),
    rubric: z.object({ "1": text, "2": text, "3": text, "4": text, "5": text }),
  })
  .strict();
export const ScenarioFamilySchema = z
  .object({
    id,
    name: text.optional(),
    archetype: text,
    difficulty: z
      .object({
        hiddenFacts: z.number().int().min(1).max(20),
        complications: z.number().int().min(0).max(10),
        ambiguity: z.enum(["low", "medium", "high"]),
      })
      .strict(),
    ranges: z.record(
      z.string().min(1).max(80),
      z.tuple([
        z.number().finite().min(0).max(1e9),
        z.number().finite().min(0).max(1e9),
      ]),
    ),
    competencyIds: z.array(id).min(1).max(5),
  })
  .strict();
export const BlueprintSchema = z
  .object({
    title: text,
    seniority: text,
    description: text,
    durationMinutes: z.number().int().min(5).max(120),
    competencies: z.array(CompetencySchema).min(4).max(5),
    environment: text,
    tools: z.array(text).min(1).max(8),
    dataTypes: z.array(text).min(1).max(8),
    strongEvidence: z.array(text).min(1).max(8),
    constraints: z.array(text).min(1).max(8),
    families: z.array(ScenarioFamilySchema).min(2).max(3),
  })
  .strict();
export const AssessmentSchema = z.object({
  id,
  lineageId: id,
  ownerId: id,
  version: z.number().int().positive(),
  status: z.enum(["draft", "published", "closed"]),
  blueprint: BlueprintSchema,
  monitoring: monitoringPolicySchema.optional(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
  demo: z.boolean(),
});
export const InviteSchema = z.object({
  monitoring: monitoringPolicySchema.optional(),
  id,
  assessmentId: id,
  token: z.string().min(32),
  candidateName: text,
  candidateEmail: z.email(),
  status: z.enum([
    "invited",
    "in progress",
    "completed",
    "reviewed",
    "archived",
  ]),
  createdAt: z.string(),
  sessionId: id.nullable(),
  demo: z.boolean(),
});
export const FactSchema = z.union([z.string().max(4000), z.number().finite()]);
export const InfoSchema = z
  .object({ title: text, data: z.record(z.string(), FactSchema) })
  .strict();
export const WorldSchema = z.object({
  company: text,
  role: text,
  context: text,
  facts: z.record(z.string(), FactSchema),
  hiddenFacts: z.record(z.string(), FactSchema),
  events: z.array(text),
  eventMetadata: z
    .array(z.object({ title: text, createdAt: z.string() }))
    .optional(),
  tools: z.array(text),
});
export const MessageSchema = z.object({
  id,
  role: z.enum(["manager", "candidate"]),
  text,
  createdAt: z.string(),
  turn: z.number().int().min(0).max(6),
});
export const CompetencyEvidenceSchema = z.object({
  competencyId: id,
  quote: text,
  note: text,
  turn: z.number().int().min(1).max(6),
});
export const TurnResultSchema = z
  .object({
    reply: text,
    revealedInfo: z.array(InfoSchema).max(8).optional(),
    newEvents: z.array(text).max(3).optional(),
    evidence: z.array(CompetencyEvidenceSchema.omit({ turn: true })).max(10),
    nextObjective: id,
    shouldEnd: z.boolean(),
  })
  .strict();
export const SessionSchema = z.object({
  id,
  inviteId: id,
  assessmentId: id,
  assessmentVersion: z.number().int().positive(),
  blueprint: BlueprintSchema,
  seed: id,
  familyId: id,
  world: WorldSchema,
  messages: z.array(MessageSchema),
  evidence: z.array(CompetencyEvidenceSchema),
  revealedInfo: z.array(InfoSchema),
  revealedDates: z.array(z.string()).optional(),
  nextObjective: id,
  draft: z.string().max(4000).default(""),
  requests: z
    .array(z.object({ id: z.string(), message: z.string(), turn: z.number() }))
    .default([]),
  turns: z.number().int().min(0).max(6),
  status: z.enum(["active", "ready", "completed"]),
  startedAt: z.string(),
  deadline: z.string(),
  completedAt: z.string().nullable(),
  reportId: id.nullable(),
  demo: z.boolean(),
});
export const RatingSchema = z
  .object({
    competencyId: id,
    score: z.number().int().min(1).max(5).nullable(),
    quotes: z.array(text).max(10),
    sufficiency: z.enum(["insufficient", "limited", "supported"]),
    rationale: text,
  })
  .strict();
export const EvaluationSchema = z
  .object({
    ratings: z.array(RatingSchema).min(4).max(5),
    strengths: z.array(text).max(8),
    weaknesses: z.array(text).max(8),
    reasoningMistakes: z.array(text).max(8),
    contradictions: z.array(text).max(8),
    followUpTopics: z.array(text).max(8),
    uncertainty: z.enum(["low", "medium", "high"]),
  })
  .strict();
export const ReportSchema = EvaluationSchema.extend({
  id,
  sessionId: id,
  assessmentId: id,
  overallScore: z.number().min(1).max(5).nullable(),
  coverage: z.number().min(0).max(100),
  untestedCompetencies: z.array(id),
  notes: z.string().max(10000),
  reviewed: z.boolean(),
  decision: z.enum(["undecided", "advance", "hold", "decline"]),
  createdAt: z.string(),
  demo: z.boolean(),
});
export type Blueprint = z.infer<typeof BlueprintSchema>;
export type Competency = z.infer<typeof CompetencySchema>;
export type ScenarioFamily = z.infer<typeof ScenarioFamilySchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type Invite = z.infer<typeof InviteSchema>;
export type World = z.infer<typeof WorldSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CompetencyEvidence = z.infer<typeof CompetencyEvidenceSchema>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
