import { z } from "zod";
import { bearer, body, response } from "@/lib/hiring/http";
import { saveMonitoringConsent } from "@/lib/hiring/monitoring";
import { HiringError } from "@/lib/hiring/error";
export const runtime = "nodejs";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return response(async () => {
    const { token } = await params;
    if (bearer(r) !== token)
      throw new HiringError("This invitation is unavailable.", 404);
    const d = await body(
      r,
      z
        .object({
          accepted: z.boolean(),
          policyVersion: z.number().int().positive(),
        })
        .strict(),
    );
    return saveMonitoringConsent(token, d.accepted, d.policyVersion);
  });
}
