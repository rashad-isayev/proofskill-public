import { response } from "@/lib/hiring/http";
import { transaction } from "@/lib/hiring/store";
import { recordingPolicy } from "@/lib/recording/store";
import { createHash } from "node:crypto";
import { HiringError } from "@/lib/hiring/error";
export const runtime = "nodejs";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return response(async () => {
    const { token } = await params;
    return transaction(async (db) => {
      if (!/^[a-f0-9]{64}$/.test(token))
        throw new HiringError("This invitation is unavailable.", 404);
      const q = await db.query(
        "SELECT id FROM proofskill_hiring_invite WHERE token_hash=$1 AND COALESCE((payload->>'demo')::boolean,false)=false",
        [createHash("sha256").update(token).digest("hex")],
      );
      if (!q.rows[0])
        throw new HiringError("This invitation is unavailable.", 404);
      return { policy: recordingPolicy() };
    });
  });
}
