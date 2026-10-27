import { bearer, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { publicCandidate } from "@/lib/hiring/presentation";
import { restoreSimulation } from "@/lib/hiring/store";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => ({
    session: publicCandidate(
      await restoreSimulation((await params).id, bearer(r)),
    ),
  }));
}
