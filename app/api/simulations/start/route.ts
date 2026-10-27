import { z } from "zod";
import { body, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { publicCandidate } from "@/lib/hiring/presentation";
import { startSimulation } from "@/lib/hiring/store";
export async function POST(r: Request) {
  return response(async () => {
    const data = await body(
      r,
      z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/),
          preview: z.boolean().optional(),
        })
        .strict(),
    );
    const result = await startSimulation(data.token, data.preview);
    return result.session
      ? { session: publicCandidate(result.session) }
      : result;
  });
}
