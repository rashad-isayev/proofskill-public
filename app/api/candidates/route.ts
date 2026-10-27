import { hr, body, response } from "@/lib/hiring/http";
import { candidateInputSchema } from "@/lib/candidates/contracts";
import { listCandidates, addCandidate } from "@/lib/candidates/store";
export const runtime = "nodejs";
export async function GET() {
  return response(async () => listCandidates(await hr()));
}
export async function POST(r: Request) {
  return response(async () => {
    const owner = await hr();
    return addCandidate(owner, await body(r, candidateInputSchema));
  });
}
