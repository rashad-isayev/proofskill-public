import { z } from "zod";
import { hr, body, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { blueprintSchema } from "@/lib/contracts";
import {
  persistedBlueprint,
  publicAssessment,
} from "@/lib/hiring/presentation";
import { saveAssessment, listAssessments } from "@/lib/hiring/store";
export async function GET() {
  return response(async () => ({
    assessments: (await listAssessments(await hr())).map(publicAssessment),
  }));
}
export async function POST(r: Request) {
  return response(async () => {
    const owner = await hr();
    const data = await body(
      r,
      z
        .object({
          blueprint: blueprintSchema,
          monitoring: z
            .object({
              version: z.number().int().positive().optional(),
              enabled: z.boolean(),
              restrictClipboard: z.boolean(),
            })
            .strict()
            .optional(),
          status: z.enum(["draft", "published", "closed"]),
          assessmentId: z.string().optional(),
          baseVersion: z.number().int().optional(),
          requestId: z.string().uuid(),
        })
        .strict(),
    );
    return {
      assessment: publicAssessment(
        await saveAssessment(owner, {
          id: data.assessmentId,
          monitoring: data.monitoring,
          blueprint: persistedBlueprint(data.blueprint),
          status: data.status,
          baseVersion: data.baseVersion,
          requestId: data.requestId,
        }),
      ),
    };
  });
}
