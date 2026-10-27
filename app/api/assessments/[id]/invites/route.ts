import { z } from "zod";
import { hr, body, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { createInvite } from "@/lib/hiring/store";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => {
    const owner = await hr();
    const data = await body(
      r,
      z
        .object({
          candidateName: z.string().trim().min(1).max(150),
          candidateEmail: z.email().max(254),
          assessmentVersion: z.number().int().positive(),
          requestId: z.string().uuid(),
        })
        .strict(),
    );
    const invite = await createInvite(
      owner,
      (await params).id,
      data.candidateName,
      data.candidateEmail,
      data.requestId,
      data.assessmentVersion,
    );
    return {
      invite: {
        ...invite,
        startedAt: null,
        durationSeconds: null,
        reportId: null,
      },
      url: new URL("/invite/" + invite.token, process.env.BETTER_AUTH_URL).href,
    };
  });
}
