import { z } from "zod";
import { body, bearer, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { completeSimulation } from "@/lib/hiring/store";
export async function POST(r: Request) {
  return response(async () => {
    const data = await body(
      r,
      z.object({ sessionId: z.string().uuid() }).strict(),
    );
    await completeSimulation(data.sessionId, bearer(r));
    return { status: "completed" };
  });
}
