import { z } from "zod";
import {
  frontendReportSchema,
  reviewSchema,
} from "@/components/reports/report-model";
import { sampleRecords } from "@/components/reports/sample-records";
import { getLab } from "@/lib/labs/catalog";
import { taskErrors, isLabAttempt } from "@/lib/labs/contracts";

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  headline: z.string().trim().max(160),
  career: z.enum(["software-engineer", "product-analyst", "undecided"]),
  about: z.string().trim().max(2000),
});
export const accountWorkspaceSchema = z
  .object({
    version: z.literal(1),
    profile: profileSchema.nullable(),
    records: z
      .array(
        z.object({
          report: frontendReportSchema,
          // Browser imports remain unverified even after server persistence.
          source: z.enum(["sample", "imported"]),
        }),
      )
      .max(50),
    reviews: z.record(z.string().max(120), reviewSchema),
    attempts: z
      .array(z.custom<import("@/lib/labs/contracts").LabAttempt>(isLabAttempt))
      .max(100),
  })
  .superRefine((data, ctx) => {
    for (const record of data.records) {
      const sample = sampleRecords.find(
        (r) => r.report.id === record.report.id,
      );
      if (
        (record.source === "sample" && !sample) ||
        (sample &&
          (record.source !== "sample" ||
            JSON.stringify(sample.report) !== JSON.stringify(record.report)))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Reserved samples must retain their fictional source and original content.",
        });
    }
    for (const attempt of data.attempts) {
      const lab = getLab(attempt.labId);
      if (
        !/^[a-zA-Z0-9_-]{1,120}$/.test(attempt.id) ||
        !lab ||
        attempt.labVersion !== lab.version ||
        Object.keys(attempt.responses).length !== lab.tasks.length ||
        lab.tasks.some(
          (task) =>
            typeof attempt.responses[task.id] !== "string" ||
            attempt.responses[task.id].length > task.maxLength,
        ) ||
        (attempt.status === "submitted" &&
          Object.keys(taskErrors(lab, attempt.responses)).length)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Invalid lab evidence or definition version.",
        });
      }
    }
    const allowedReviews = new Set([
      "sample",
      "sample-alternate",
      ...data.records.map((r) => r.report.id),
    ]);
    if (Object.keys(data.reviews).some((id) => !allowedReviews.has(id)))
      ctx.addIssue({
        code: "custom",
        message: "Review must refer to available evidence.",
      });
    const ids = data.records.map((r) => r.report.id);
    const attemptIds = data.attempts.map((a) => a.id);
    if (
      new Set(ids).size !== ids.length ||
      new Set(attemptIds).size !== attemptIds.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate record identifiers.",
      });
    if (Object.keys(data.reviews).length > 100)
      ctx.addIssue({ code: "custom", message: "Too many review records." });
  });
export type AccountWorkspace = z.infer<typeof accountWorkspaceSchema>;
export const emptyAccountWorkspace: AccountWorkspace = {
  version: 1,
  profile: null,
  records: [],
  reviews: {},
  attempts: [],
};
