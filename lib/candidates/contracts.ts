import { z } from "zod";

export const decisions = [
  "pending-review",
  "selected",
  "rejected",
  "deferred",
  "follow-up-required",
] as const;
export const decisionSchema = z.enum(decisions);
export const decisionLabels: Record<(typeof decisions)[number], string> = {
  "pending-review": "Pending review",
  selected: "Selected",
  rejected: "Rejected",
  deferred: "Deferred",
  "follow-up-required": "Follow-up required",
};
export const candidateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    position: z.string().trim().max(160).default(""),
  })
  .strict();
export const assignmentSchema = z.object({
  id: z.string().uuid(),
  assessmentId: z.string(),
  assessmentVersion: z.number().int().positive(),
  title: z.string(),
  progress: z.enum([
    "invited",
    "in-progress",
    "completed",
    "expired",
    "closed",
  ]),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  lastActivity: z.string().datetime(),
  reportId: z.string().nullable(),
  invitePath: z.string().nullable(),
});
export const candidateSchema = candidateInputSchema.extend({
  id: z.string().uuid(),
  decision: decisionSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  assignments: z.array(assignmentSchema),
});
export const directorySchema = z.object({
  candidates: z.array(candidateSchema),
});
export const importInputSchema = z
  .object({
    candidates: z.array(candidateInputSchema).min(1).max(500),
    requestId: z.string().uuid(),
  })
  .strict();
export const importResultSchema = z.object({
  created: z.number().int(),
  skipped: z.array(z.string()),
});
export const assignInputSchema = z
  .object({
    candidateIds: z.array(z.string().uuid()).min(1).max(100),
    assessmentId: z.string().uuid(),
    assessmentVersion: z.number().int().positive(),
    requestId: z.string().uuid(),
  })
  .strict()
  .refine(
    (d) => new Set(d.candidateIds).size === d.candidateIds.length,
    "Select each candidate once.",
  );
export const assignResultSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
});
export const updateCandidateSchema = z
  .object({
    decision: decisionSchema,
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type CandidateInput = z.infer<typeof candidateInputSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
