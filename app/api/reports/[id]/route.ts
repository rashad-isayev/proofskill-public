import { z } from "zod";
import { hr, body, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { publicReport } from "@/lib/hiring/presentation";
import { getReport, reviewReport } from "@/lib/hiring/store";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => ({
    report: publicReport(await getReport(await hr(), (await params).id)),
  }));
}
export async function PATCH(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => {
    const owner = await hr();
    const data = await body(
      r,
      z
        .object({
          reviewerNotes: z.string().max(10000),
          reviewed: z.boolean(),
          humanDecision: z.enum(["undecided", "advance", "hold", "decline"]),
        })
        .strict(),
    );
    const id = (await params).id;
    await reviewReport(owner, id, {
      notes: data.reviewerNotes,
      reviewed: data.reviewed,
      decision: data.humanDecision,
    });
    return { report: publicReport(await getReport(owner, id)) };
  });
}
