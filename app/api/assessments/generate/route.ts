import { z } from "zod";
import { publicBlueprint } from "@/lib/hiring/presentation";
import { hr, body, response } from "@/lib/hiring/http";
import { scopedModel } from "@/lib/hiring/ai-budget";
import { providerCall } from "@/lib/hiring/llm";
export const runtime = "nodejs";
export const maxDuration = 120;
import { generateAssessmentBlueprint } from "@/lib/hiring/orchestration";
export async function POST(r: Request) {
  return response(async () => {
    const owner = await hr();
    const input = await body(
      r,
      z
        .object({
          jobTitle: z.string().min(3).max(150),
          seniority: z.string().min(2).max(100),
          jobDescription: z.string().min(20).max(10000),
          durationMinutes: z.number().int().min(5).max(120),
          competencies: z.array(z.string().max(200)).max(10).optional(),
        })
        .strict(),
    );
    return {
      blueprint: publicBlueprint(
        await generateAssessmentBlueprint(
          {
            title: input.jobTitle,
            description: input.jobDescription,
            seniority: input.seniority,
            durationMinutes: input.durationMinutes,
            competencies: input.competencies?.join("\n"),
          },
          scopedModel("hr:" + owner, providerCall),
        ),
      ),
    };
  });
}
