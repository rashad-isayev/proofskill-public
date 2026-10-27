import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { accountDatabase } from "@/lib/account/database";
import { HiringError } from "@/lib/hiring/error";
import {
  transaction,
  savedRequest,
  rememberRequest,
  ownedAssessment,
  createInviteInTransaction,
  hashToken,
} from "@/lib/hiring/store";
import { invitationToken } from "./records";
import {
  directorySchema,
  importInputSchema,
  importResultSchema,
  assignInputSchema,
  assignResultSchema,
  updateCandidateSchema,
  candidateInputSchema,
} from "./contracts";

export async function listCandidates(owner: string) {
  const db = accountDatabase();
  const candidates = await db.query(
    "SELECT * FROM proofskill_candidate WHERE owner_id=$1 ORDER BY created_at DESC,id",
    [owner],
  );
  const assignments = await db.query(
    `SELECT x.id,x.candidate_id,x.assessment_id,x.invite_request_id,x.created_at,
    i.token_hash,i.payload AS invite,a.payload AS assessment,s.payload AS session,m.disqualified
    FROM proofskill_candidate_assignment x
    JOIN proofskill_candidate c ON c.id=x.candidate_id
    JOIN proofskill_hiring_assessment a ON a.id=x.assessment_id AND a.owner_id=c.owner_id
    JOIN proofskill_hiring_invite i ON i.id=x.invite_id
    LEFT JOIN proofskill_hiring_session s ON s.invite_id=i.id
    LEFT JOIN proofskill_monitoring_state m ON m.invite_id=i.id
    WHERE c.owner_id=$1 ORDER BY x.created_at DESC,x.id`,
    [owner],
  );
  const grouped = new Map<string, unknown[]>();
  for (const row of assignments.rows) {
    const s = row.session;
    const completed = s?.status === "completed" || !!s?.reportId;
    const expired = !!s && !completed && Date.now() >= Date.parse(s.deadline);
    const token = row.invite_request_id
      ? invitationToken(owner, row.invite_request_id, row.assessment_id)
      : null;
    const item = {
      id: row.id,
      assessmentId: row.assessment_id,
      assessmentVersion: row.assessment.version,
      title: row.assessment.blueprint.title,
      // Unstarted invitations stop working once their assessment version is closed.
      progress:
        row.disqualified || (!s && row.assessment.status === "closed")
          ? "closed"
          : completed
            ? "completed"
            : expired
              ? "expired"
              : s
                ? "in-progress"
                : "invited",
      createdAt: row.created_at.toISOString(),
      startedAt: s?.startedAt ?? null,
      completedAt: s?.completedAt ?? null,
      lastActivity:
        s?.completedAt ??
        s?.messages?.at(-1)?.createdAt ??
        s?.startedAt ??
        row.created_at.toISOString(),
      reportId: s?.reportId ?? null,
      invitePath:
        token && hashToken(token) === row.token_hash
          ? "/invite/" + token
          : null,
    };
    const items = grouped.get(row.candidate_id) ?? [];
    items.push(item);
    grouped.set(row.candidate_id, items);
  }
  return directorySchema.parse({
    candidates: candidates.rows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      position: c.position,
      decision: c.decision,
      revision: c.revision,
      createdAt: c.created_at.toISOString(),
      updatedAt: c.updated_at.toISOString(),
      assignments: grouped.get(c.id) ?? [],
    })),
  });
}
export async function importCandidates(
  owner: string,
  raw: z.infer<typeof importInputSchema>,
) {
  const input = importInputSchema.parse(raw);
  return transaction(async (db) => {
    const prior = await savedRequest(
      db,
      owner,
      input.requestId,
      "candidate-import",
      input,
    );
    if (prior) return importResultSchema.parse(prior);
    let created = 0;
    const skipped: string[] = [];
    for (const c of [...input.candidates].sort((a, b) =>
      a.email.localeCompare(b.email),
    )) {
      const result = await db.query(
        "INSERT INTO proofskill_candidate(id,owner_id,name,email,position) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,email) DO NOTHING RETURNING id",
        [randomUUID(), owner, c.name, c.email, c.position],
      );
      if (result.rowCount) created++;
      else skipped.push(c.email);
    }
    const result = { created, skipped };
    await rememberRequest(
      db,
      owner,
      input.requestId,
      "candidate-import",
      input,
      result,
    );
    return result;
  });
}
export async function addCandidate(owner: string, raw: unknown) {
  const c = candidateInputSchema.parse(raw);
  const result = await importCandidates(owner, {
    candidates: [c],
    requestId: randomUUID(),
  });
  if (!result.created)
    throw new HiringError("A candidate with this email already exists.", 409);
  return result;
}
export async function assignCandidates(
  owner: string,
  raw: z.infer<typeof assignInputSchema>,
) {
  const input = assignInputSchema.parse(raw);
  return transaction(async (db) => {
    const prior = await savedRequest(
      db,
      owner,
      input.requestId,
      "candidate-assign",
      input,
    );
    if (prior) return assignResultSchema.parse(prior);
    const assessment = await ownedAssessment(
      db,
      input.assessmentId,
      owner,
      true,
    );
    if (
      assessment.status !== "published" ||
      assessment.version !== input.assessmentVersion
    )
      throw new HiringError(
        "Choose a current published assessment version.",
        409,
      );
    // All batches lock candidates in the same order, after the assessment.
    const q = await db.query(
      "SELECT * FROM proofskill_candidate WHERE owner_id=$1 AND id=ANY($2::text[]) ORDER BY id FOR UPDATE",
      [owner, input.candidateIds],
    );
    if (q.rows.length !== input.candidateIds.length)
      throw new HiringError("One or more candidates are unavailable.", 404);
    let created = 0,
      skipped = 0;
    for (const c of q.rows) {
      const existing = await db.query(
        "SELECT id FROM proofskill_candidate_assignment WHERE candidate_id=$1 AND assessment_id=$2",
        [c.id, assessment.id],
      );
      if (existing.rowCount) {
        skipped++;
        continue;
      }
      await createInviteInTransaction(
        db,
        owner,
        assessment.id,
        c.name,
        c.email,
        randomUUID(),
        assessment.version,
      );
      created++;
    }
    const result = { created, skipped };
    await rememberRequest(
      db,
      owner,
      input.requestId,
      "candidate-assign",
      input,
      result,
    );
    return result;
  });
}
export async function updateCandidateDecision(
  owner: string,
  id: string,
  raw: z.infer<typeof updateCandidateSchema>,
) {
  const data = updateCandidateSchema.parse(raw);
  const q = await accountDatabase().query(
    "UPDATE proofskill_candidate SET decision=$3,revision=revision+1,updated_at=now() WHERE owner_id=$1 AND id=$2 AND revision=$4 RETURNING id",
    [owner, id, data.decision, data.revision],
  );
  if (!q.rowCount) {
    const exists = await accountDatabase().query(
      "SELECT id FROM proofskill_candidate WHERE owner_id=$1 AND id=$2",
      [owner, id],
    );
    throw new HiringError(
      exists.rowCount
        ? "This candidate changed in another tab. Refresh and try again."
        : "This candidate is unavailable.",
      exists.rowCount ? 409 : 404,
    );
  }
  return { saved: true };
}
