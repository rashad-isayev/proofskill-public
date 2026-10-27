import "server-only";
import { randomUUID, createHmac } from "node:crypto";
import type { PoolClient } from "pg";

export function invitationToken(
  owner: string,
  requestId: string,
  assessmentId: string,
) {
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(owner + ":" + requestId + ":" + assessmentId)
    .digest("hex");
}
export async function linkInviteToCandidate(
  db: PoolClient,
  owner: string,
  input: {
    name: string;
    email: string;
    position: string;
    assessmentId: string;
    inviteId: string;
    requestId?: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  await db.query(
    "INSERT INTO proofskill_candidate(id,owner_id,name,email,position) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,email) DO NOTHING",
    [randomUUID(), owner, input.name, email, input.position],
  );
  const c = await db.query(
    "SELECT id FROM proofskill_candidate WHERE owner_id=$1 AND email=$2",
    [owner, email],
  );
  await db.query(
    "INSERT INTO proofskill_candidate_assignment(id,candidate_id,assessment_id,invite_id,invite_request_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(invite_id) DO NOTHING",
    [
      randomUUID(),
      c.rows[0].id,
      input.assessmentId,
      input.inviteId,
      input.requestId ?? null,
    ],
  );
}
