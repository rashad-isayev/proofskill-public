import { hr, body, response } from "@/lib/hiring/http";
import { assignInputSchema } from "@/lib/candidates/contracts";
import { assignCandidates } from "@/lib/candidates/store";
export const runtime = "nodejs";
export async function POST(r: Request) {
  return response(async () => {
    const owner = await hr();
    return assignCandidates(owner, await body(r, assignInputSchema));
  });
}
