// Proposed additive monitoring boundary. Developer 2 must implement and review it
// before ASSESSMENT_MONITORING_ENABLED is enabled. Existing hiring schemas stay intact.
import { z } from "zod";
export const monitoringPolicySchema = z
  .object({
    version: z.number().int().positive(),
    enabled: z.boolean(),
    restrictClipboard: z.boolean(),
    notice: z.string().min(1).max(4000),
  })
  .strict();
export const monitoringEnvelope = z
  .object({
    policy: monitoringPolicySchema,
    attempts: z
      .array(
        z.object({
          invite_id: z.string(),
          candidate_name: z.string(),
          warnings: z.number().nullable(),
          disqualified: z.boolean().nullable(),
          consent: z.boolean().nullable(),
          consent_at: z.string().nullable(),
          activity_count: z.number(),
        }),
      )
      .optional(),
  })
  .strict();
export const monitoringStateSchema = z
  .object({
    fullscreenWarnings: z.number().int().min(0).max(3),
    disqualified: z.boolean(),
  })
  .strict()
  .refine(
    (state) => state.disqualified || state.fullscreenWarnings < 3,
    "Three warnings must terminate the assessment",
  );
export const candidateMonitoringEnvelope = z
  .object({ policy: monitoringPolicySchema, state: monitoringStateSchema })
  .strict();
export const monitoringEventAck = z
  .object({ saved: z.literal(true), state: monitoringStateSchema })
  .strict();
export const monitoringAck = z.object({ saved: z.literal(true) }).strict();
export type MonitoringPolicy = z.infer<typeof monitoringPolicySchema>;
export type MonitoringEventKind =
  | "fullscreen-exit"
  | "page-hidden"
  | "window-blur"
  | "camera-ended"
  | "screen-ended"
  | "clipboard-blocked";
