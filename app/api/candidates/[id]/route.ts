import { hr, body, response } from "@/lib/hiring/http";
import { updateCandidateSchema } from "@/lib/candidates/contracts";
import { updateCandidateDecision } from "@/lib/candidates/store";
export const runtime = "nodejs";
export async function PATCH(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => {
    const owner = await hr();
    return updateCandidateDecision(
      owner,
      (await params).id,
      await body(r, updateCandidateSchema),
    );
  });
}
