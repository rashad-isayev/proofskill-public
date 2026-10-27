import { z } from "zod";
import { body, bearer, response } from "@/lib/hiring/http";
import { saveCandidateDraft } from "@/lib/hiring/store";
export async function POST(r: Request) {
  return response(async () => {
    const d = await body(
      r,
      z
        .object({
          sessionId: z.string().uuid(),
          draft: z.string().max(4000),
          expectedTurns: z.number().int().min(0).max(6),
        })
        .strict(),
    );
    return saveCandidateDraft(d.sessionId, bearer(r), d.draft, d.expectedTurns);
  });
}
