import { z } from "zod";
import { hr, body, response } from "@/lib/hiring/http";
import {
  assessmentMonitoring,
  updateAssessmentMonitoring,
  hrMonitoringEvidence,
} from "@/lib/hiring/monitoring";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, { params }: Context) {
  return response(async () => {
    const owner = await hr(),
      { id } = await params;
    return {
      ...(await assessmentMonitoring(owner, id)),
      attempts: await hrMonitoringEvidence(owner, id),
    };
  });
}
export async function PUT(r: Request, { params }: Context) {
  return response(async () =>
    updateAssessmentMonitoring(
      await hr(),
      (await params).id,
      await body(
        r,
        z
          .object({
            version: z.number().int().positive(),
            enabled: z.boolean(),
            restrictClipboard: z.boolean(),
          })
          .strict(),
      ),
    ),
  );
}
