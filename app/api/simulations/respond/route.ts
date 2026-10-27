import { z } from "zod";
import { body, bearer, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 240;
import { publicCandidate } from "@/lib/hiring/presentation";
import { respondSimulation } from "@/lib/hiring/store";
export async function POST(r: Request) {
  return response(async () => {
    const data = await body(
      r,
      z
        .object({
          sessionId: z.string().uuid(),
          message: z.string().trim().min(1).max(4000),
          expectedTurns: z.number().int().min(0).max(6).optional(),
          requestId: z.string().uuid(),
        })
        .strict(),
    );
    return {
      session: publicCandidate(
        await respondSimulation(
          data.sessionId,
          bearer(r),
          data.message,
          data.expectedTurns,
          undefined,
          data.requestId,
        ),
      ),
    };
  });
}
