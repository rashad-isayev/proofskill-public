import { z } from "zod";
import { hr, body, response } from "@/lib/hiring/http";
import { completeSimulation } from "@/lib/hiring/store";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(r: Request) {
  return response(async () => {
    const owner = await hr();
    const d = await body(
      r,
      z.object({ sessionId: z.string().uuid() }).strict(),
    );
    await completeSimulation(d.sessionId, { owner });
    return { saved: true };
  });
}
