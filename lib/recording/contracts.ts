import { z } from "zod";
export const sourceSchema = z.enum(["camera", "screen"]);
export const mimeSchema = z.enum([
  "video/webm",
  "video/webm;codecs=vp8",
  "video/webm;codecs=vp9",
]);
export const recordingSchema = z
  .object({
    id: z.uuid(),
    source: sourceSchema,
    mime: mimeSchema,
    status: z.enum(["recording", "complete", "interrupted"]),
    chunks: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export const recordingPolicySchema = z
  .object({
    enabled: z.boolean(),
    retentionDays: z.number().int().positive().nullable(),
    notice: z.string(),
  })
  .strict();
export const recordingPolicyEnvelope = z
  .object({ policy: recordingPolicySchema })
  .strict();
export const recordingStartSchema = z
  .object({
    source: sourceSchema,
    mime: mimeSchema,
    requestId: z.uuid(),
    retentionDays: z.number().int().positive(),
    accepted: z.literal(true),
  })
  .strict();
export const recordingStartEnvelope = z
  .object({ recording: recordingSchema })
  .strict();
export const recordingListEnvelope = z
  .object({
    recordings: z.array(
      recordingSchema.extend({
        candidateName: z.string(),
        sessionId: z.string(),
      }),
    ),
  })
  .strict();
export const recordingFinishSchema = z
  .object({
    chunks: z.number().int().min(0).max(300),
    interrupted: z.boolean(),
  })
  .strict();
