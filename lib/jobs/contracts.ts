import { z } from "zod";
export const jobSchema = z.object({
  title: z.string().trim().min(3).max(120),
  team: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(100),
  description: z.string().trim().min(80).max(6000),
});
export const applicationSchema = z.object({
  note: z.string().trim().min(40).max(4000),
  reportId: z.string().max(120).nullable(),
  consent: z.literal(true),
});
export const applicationStatusSchema = z.enum([
  "submitted",
  "in-review",
  "follow-up",
  "closed",
]);
export type Job = z.infer<typeof jobSchema> & { id: string; createdAt: string };
export type Application = {
  id: string;
  jobId: string;
  title: string;
  note: string;
  status: z.infer<typeof applicationStatusSchema>;
  createdAt: string;
  candidateName?: string;
  candidateEmail?: string;
  evidence: unknown | null;
};
