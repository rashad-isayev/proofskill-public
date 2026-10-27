import { hr, response } from "@/lib/hiring/http";
import { checkOrigin, boundedJSON } from "@/lib/account/access";
import { importInputSchema } from "@/lib/candidates/contracts";
import { importCandidates } from "@/lib/candidates/store";
export const runtime = "nodejs";
export async function POST(r: Request) {
  return response(async () => {
    const owner = await hr();
    checkOrigin(r);
    return importCandidates(
      owner,
      importInputSchema.parse(await boundedJSON(r, 1000000)),
    );
  });
}
