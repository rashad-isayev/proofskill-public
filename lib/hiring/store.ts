import "server-only";
import { assertMonitoring } from "./monitoring";
import { defaultMonitoring } from "./monitoring-policy";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { linkInviteToCandidate } from "@/lib/candidates/records";
import { accountDatabase } from "@/lib/account/database";
import { HiringError as AccountError } from "./error";
import {
  AssessmentSchema,
  SessionSchema,
  ReportSchema,
  type Assessment,
  type Invite,
  type Session,
  type Report,
  type Blueprint,
} from "@/lib/hiring/internal-contracts";
import {
  generateCandidateScenario,
  processAdaptiveTurn,
  evaluateCandidateSession,
} from "./orchestration";
import {
  validateBlueprint,
  candidateSafe,
  weightedScore,
  shouldEnd,
} from "./validation";
import { providerCall, type ModelCall } from "./llm";
import { scopedModel } from "./ai-budget";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const now = () => new Date().toISOString();
const missing = () => new AccountError("This record is unavailable.", 404);
export async function transaction<T>(fn: (db: PoolClient) => Promise<T>) {
  const db = await accountDatabase().connect();
  try {
    await db.query("BEGIN");
    // Provider work may hold a session lock; competing requests must not occupy
    // the entire application pool while waiting for that lock.
    await db.query("SET LOCAL lock_timeout = '2s'");
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function savedRequest(
  db: PoolClient,
  owner: string,
  requestId: string | undefined,
  operation: string,
  input: unknown,
) {
  if (!requestId) return null;
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    owner + ":" + requestId,
  ]);
  const q = await db.query(
    "SELECT operation,input_hash,payload FROM proofskill_hiring_request WHERE owner_id=$1 AND request_id=$2",
    [owner, requestId],
  );
  if (!q.rows[0]) return null;
  if (
    q.rows[0].operation !== operation ||
    q.rows[0].input_hash !== hashToken(JSON.stringify(input))
  )
    throw new AccountError(
      "This request key was used for different data.",
      409,
    );
  return q.rows[0].payload;
}
export async function rememberRequest(
  db: PoolClient,
  owner: string,
  requestId: string | undefined,
  operation: string,
  input: unknown,
  payload: unknown,
) {
  if (requestId)
    await db.query(
      "INSERT INTO proofskill_hiring_request(owner_id,request_id,operation,input_hash,payload) VALUES($1,$2,$3,$4,$5)",
      [
        owner,
        requestId,
        operation,
        hashToken(JSON.stringify(input)),
        JSON.stringify(payload),
      ],
    );
}
export function isArchived(s: Session) {
  return s.status === "completed" || Date.now() >= Date.parse(s.deadline);
}
const archivedError = () => new AccountError("This session is archived.", 410);
export async function ownedAssessment(
  db: PoolClient,
  id: string,
  owner: string,
  lock = false,
): Promise<Assessment> {
  const q = await db.query(
    `SELECT payload FROM proofskill_hiring_assessment WHERE id=$1 AND owner_id=$2 AND COALESCE((payload->>'demo')::boolean,false)=false ${lock ? "FOR UPDATE" : ""}`,
    [id, owner],
  );
  if (!q.rows[0]) throw missing();
  return AssessmentSchema.parse(q.rows[0].payload);
}
export async function saveAssessment(
  owner: string,
  input: {
    id?: string;
    baseVersion?: number;
    requestId?: string;
    blueprint: Blueprint;
    monitoring?: {
      version?: number;
      enabled: boolean;
      restrictClipboard: boolean;
    };
    status: "draft" | "published" | "closed";
  },
) {
  const blueprint = validateBlueprint(input.blueprint);
  return transaction(async (db) => {
    const prior = await savedRequest(
      db,
      owner,
      input.requestId,
      "assessment",
      input,
    );
    if (prior) return AssessmentSchema.parse(prior);
    let previous: Assessment | undefined;
    if (input.id) previous = await ownedAssessment(db, input.id, owner, true);
    if (
      previous &&
      input.baseVersion !== undefined &&
      previous.version !== input.baseVersion
    )
      throw new AccountError(
        "This assessment changed. Refresh before saving.",
        409,
      );
    if (previous && input.status === "closed") {
      if (previous.status !== "published")
        throw new AccountError(
          "Only published assessments can be closed.",
          409,
        );
      const closed = { ...previous, status: "closed" as const };
      await db.query(
        "UPDATE proofskill_hiring_assessment SET payload=$2 WHERE id=$1",
        [previous.id, JSON.stringify(closed)],
      );
      await rememberRequest(
        db,
        owner,
        input.requestId,
        "assessment",
        input,
        closed,
      );
      return closed;
    }
    if (previous?.status === "closed")
      throw new AccountError("Closed assessments cannot be edited.", 409);
    let version = previous?.version ?? 1;
    if (previous?.status === "draft") version++;
    if (previous?.status === "published") {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `assessment-version:${previous.lineageId}`,
      ]);
      const versions = await db.query(
        "SELECT max(version) as version FROM proofskill_hiring_assessment WHERE lineage_id=$1",
        [previous.lineageId],
      );
      version = Number(versions.rows[0].version) + 1;
    }
    const id = previous?.status === "draft" ? previous.id : randomUUID();
    const monitoring = previous?.monitoring ?? defaultMonitoring();
    if (
      input.monitoring?.version !== undefined &&
      input.monitoring.version !== monitoring.version
    )
      throw new AccountError(
        "Monitoring settings changed. Refresh before saving.",
        409,
      );
    const nextMonitoring = input.monitoring
      ? {
          ...monitoring,
          enabled: input.monitoring.enabled,
          restrictClipboard: input.monitoring.restrictClipboard,
          version: monitoring.version + 1,
        }
      : monitoring;
    const a: Assessment = {
      id,
      lineageId: previous?.lineageId ?? id,
      ownerId: owner,
      version,
      status: input.status,
      blueprint,
      monitoring: nextMonitoring,
      createdAt: previous?.status === "draft" ? previous.createdAt : now(),
      publishedAt: input.status === "published" ? now() : null,
      demo: false,
    };
    await db.query(
      "INSERT INTO proofskill_hiring_assessment(id,owner_id,lineage_id,version,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,version=EXCLUDED.version",
      [a.id, owner, a.lineageId, a.version, JSON.stringify(a)],
    );
    await rememberRequest(db, owner, input.requestId, "assessment", input, a);
    return a;
  });
}
export async function listAssessments(owner: string) {
  const q = await accountDatabase().query(
    "SELECT payload FROM proofskill_hiring_assessment WHERE owner_id=$1 AND COALESCE((payload->>'demo')::boolean,false)=false ORDER BY (payload->>'createdAt') DESC",
    [owner],
  );
  return q.rows.map((r) => AssessmentSchema.parse(r.payload));
}
export async function assessmentDetails(owner: string, id: string) {
  return transaction(async (db) => {
    const assessment = await ownedAssessment(db, id, owner);
    const q = await db.query(
      `SELECT i.payload AS invite,s.payload AS session,m.disqualified FROM proofskill_hiring_invite i LEFT JOIN proofskill_hiring_session s ON s.invite_id=i.id LEFT JOIN proofskill_monitoring_state m ON m.invite_id=i.id WHERE i.assessment_id=$1 ORDER BY i.payload->>'createdAt' DESC`,
      [id],
    );
    return {
      assessment,
      candidates: q.rows.map((r) => ({
        ...r.invite,
        status:
          r.disqualified ||
          (r.session &&
            isArchived(SessionSchema.parse(r.session)) &&
            !r.session.reportId)
            ? "archived"
            : r.invite.status,
        startedAt: r.session?.startedAt ?? null,
        completedAt: r.session?.completedAt ?? null,
        reportId: r.session?.reportId ?? null,
        durationSeconds: r.session?.completedAt
          ? Math.round(
              (Date.parse(r.session.completedAt) -
                Date.parse(r.session.startedAt)) /
                1000,
            )
          : null,
      })),
    };
  });
}
export async function createInvite(
  owner: string,
  id: string,
  candidateName: string,
  candidateEmail: string,
  requestId?: string,
  assessmentVersion?: number,
) {
  return transaction((db) =>
    createInviteInTransaction(
      db,
      owner,
      id,
      candidateName,
      candidateEmail,
      requestId,
      assessmentVersion,
    ),
  );
}
export async function createInviteInTransaction(
  db: PoolClient,
  owner: string,
  id: string,
  candidateName: string,
  candidateEmail: string,
  requestId?: string,
  assessmentVersion?: number,
) {
  const input = { id, candidateName, candidateEmail, assessmentVersion };
  const prior = await savedRequest(db, owner, requestId, "invite", input);
  const token = requestId
    ? createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
        .update(owner + ":" + requestId + ":" + id)
        .digest("hex")
    : randomBytes(32).toString("hex");
  if (prior) return { ...prior, token };
  const a = await ownedAssessment(db, id, owner, true);
  if (assessmentVersion !== undefined && a.version !== assessmentVersion)
    throw new AccountError("The assessment version changed.", 409);
  if (a.status !== "published")
    throw new AccountError(
      "Publish this assessment before inviting candidates.",
      409,
    );

  const invite: Omit<Invite, "token"> = {
    id: randomUUID(),
    assessmentId: id,
    candidateName,
    candidateEmail,
    status: "invited",
    createdAt: now(),
    sessionId: null,
    demo: a.demo,
    monitoring: a.monitoring ?? defaultMonitoring(),
  };
  await db.query(
    "INSERT INTO proofskill_hiring_invite(id,assessment_id,token_hash,payload) VALUES($1,$2,$3,$4)",
    [invite.id, id, hashToken(token), JSON.stringify(invite)],
  );
  await linkInviteToCandidate(db, owner, {
    name: candidateName,
    email: candidateEmail,
    position: a.blueprint.title,
    assessmentId: id,
    inviteId: invite.id,
    requestId,
  });
  await rememberRequest(db, owner, requestId, "invite", input, {
    ...invite,
    assessmentVersion: a.version,
  });
  return { ...invite, token, assessmentVersion: a.version };
}

async function tokenInvite(db: PoolClient, token: string, lock = false) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw missing();
  const q = await db.query(
    `SELECT payload FROM proofskill_hiring_invite WHERE token_hash=$1 ${lock ? "FOR UPDATE" : ""}`,
    [hashToken(token)],
  );
  if (!q.rows[0] || q.rows[0].payload.demo) throw missing();
  return q.rows[0].payload as Omit<Invite, "token">;
}
export async function inviteEntry(token: string) {
  return transaction(async (db) => {
    const i = await tokenInvite(db, token);
    const q = await db.query(
      "SELECT payload FROM proofskill_hiring_assessment WHERE id=$1",
      [i.assessmentId],
    );
    const a = AssessmentSchema.parse(q.rows[0]?.payload);
    if (a.status !== "published" && !i.sessionId)
      throw new AccountError("This invitation is no longer available.", 410);
    const sq = i.sessionId
      ? await db.query(
          "SELECT payload FROM proofskill_hiring_session WHERE id=$1",
          [i.sessionId],
        )
      : null;
    const ms = await db.query(
      "SELECT disqualified FROM proofskill_monitoring_state WHERE invite_id=$1",
      [i.id],
    );
    const archived =
      ms.rows[0]?.disqualified ||
      (!!sq?.rows[0] && isArchived(SessionSchema.parse(sq.rows[0].payload)));
    return {
      demo: a.demo,
      roleTitle: a.blueprint.title,
      durationMinutes: a.blueprint.durationMinutes,
      status: archived
        ? "archived"
        : i.status === "in progress"
          ? "in-progress"
          : i.status,
      sessionId: archived ? null : i.sessionId,
    };
  });
}
export async function startSimulation(
  token: string,
  preview = false,
  call?: ModelCall,
) {
  return transaction(async (db) => {
    const invite = await tokenInvite(db, token, true);
    await assertMonitoring(db, invite, !preview);
    const aq = await db.query(
      "SELECT payload FROM proofskill_hiring_assessment WHERE id=$1",
      [invite.assessmentId],
    );
    const assessment = AssessmentSchema.parse(aq.rows[0]?.payload);
    const old = await db.query(
      "SELECT payload FROM proofskill_hiring_session WHERE invite_id=$1",
      [invite.id],
    );
    if (old.rows[0] && isArchived(SessionSchema.parse(old.rows[0].payload)))
      throw archivedError();
    if (old.rows[0]) {
      await assertMonitoring(db, invite);
      return {
        session: candidateSafe(SessionSchema.parse(old.rows[0].payload)),
      };
    }
    if (assessment.status !== "published")
      throw new AccountError("This invitation is no longer available.", 410);
    if (preview)
      return {
        instructions: {
          role: assessment.blueprint.title,
          durationMinutes: assessment.blueprint.durationMinutes,
          candidateName: invite.candidateName,
          demo: assessment.demo,
        },
      };
    const seed = randomBytes(16).toString("hex");
    const scenario = await generateCandidateScenario(
      assessment.blueprint,
      seed,
      scopedModel("invite:" + hashToken(token), call ?? providerCall),
    );
    const startedAt = now();
    const s: Session = {
      id: randomUUID(),
      inviteId: invite.id,
      assessmentId: assessment.id,
      assessmentVersion: assessment.version,
      blueprint: assessment.blueprint,
      seed,
      familyId: scenario.familyId,
      world: scenario.world,
      messages: [
        {
          id: randomUUID(),
          role: "manager",
          text: scenario.opening,
          createdAt: startedAt,
          turn: 0,
        },
      ],
      evidence: [],
      revealedInfo: [],
      nextObjective: assessment.blueprint.competencies[0].id,
      draft: "",
      requests: [],
      turns: 0,
      status: "active",
      startedAt,
      deadline: new Date(
        Date.parse(startedAt) + assessment.blueprint.durationMinutes * 60000,
      ).toISOString(),
      completedAt: null,
      reportId: null,
      demo: assessment.demo,
    };
    await db.query(
      "INSERT INTO proofskill_hiring_session(id,invite_id,payload) VALUES($1,$2,$3)",
      [s.id, invite.id, JSON.stringify(s)],
    );
    await db.query(
      "UPDATE proofskill_hiring_invite SET payload=$2 WHERE id=$1",
      [
        invite.id,
        JSON.stringify({ ...invite, status: "in progress", sessionId: s.id }),
      ],
    );
    return { session: candidateSafe(s) };
  });
}
async function candidateSession(
  db: PoolClient,
  id: string,
  token: string,
  lock = false,
  allowArchived = false,
) {
  const invite = await tokenInvite(db, token, true);
  await assertMonitoring(db, invite, false);
  const q = await db.query(
    `SELECT payload FROM proofskill_hiring_session WHERE id=$1 AND invite_id=$2 ${lock ? "FOR UPDATE" : ""}`,
    [id, invite.id],
  );
  if (!q.rows[0]) throw missing();
  const session = SessionSchema.parse(q.rows[0].payload);
  if (!allowArchived && isArchived(session)) throw archivedError();
  return session;
}
export async function restoreSimulation(id: string, token: string) {
  return transaction(async (db) => {
    const session = await candidateSession(db, id, token);
    await assertMonitoring(db, await tokenInvite(db, token));
    return candidateSafe(session);
  });
}
export async function respondSimulation(
  id: string,
  token: string,
  message: string,
  expectedTurns: number | undefined,
  call?: ModelCall,
  requestId?: string,
) {
  return transaction(async (db) => {
    const s = await candidateSession(db, id, token, true);
    await assertMonitoring(db, await tokenInvite(db, token));
    const prior = requestId ? s.requests.find((x) => x.id === requestId) : null;
    if (prior) {
      if (prior.message !== message)
        throw new AccountError(
          "This request key was used for another reply.",
          409,
        );
      return candidateSafe(s);
    }
    expectedTurns ??= s.turns;
    if (s.turns !== expectedTurns) {
      const last = s.messages.filter((m) => m.role === "candidate").at(-1);
      if (s.turns === expectedTurns + 1 && last?.text === message)
        return candidateSafe(s);
      throw new AccountError(
        "Another tab updated this session. Refresh before sending.",
        409,
      );
    }
    if (s.status !== "active")
      throw new AccountError("This session is ready for submission.", 409);
    if (shouldEnd(s)) {
      s.status = "ready";
      await db.query(
        "UPDATE proofskill_hiring_session SET payload=$2 WHERE id=$1",
        [s.id, JSON.stringify(s)],
      );
      return candidateSafe(s);
    }
    const turn = s.turns + 1;
    s.messages.push({
      id: randomUUID(),
      role: "candidate",
      text: message,
      createdAt: now(),
      turn,
    });
    const output = await processAdaptiveTurn(
      { ...s, turns: turn },
      scopedModel("invite:" + hashToken(token), call ?? providerCall),
    );
    if (requestId) s.requests.push({ id: requestId, message, turn });
    s.draft = "";
    s.turns = turn;
    s.evidence.push(...output.evidence.map((e) => ({ ...e, turn })));
    s.nextObjective = output.nextObjective;
    s.world.eventMetadata ??= s.world.events.map((title) => ({
      title,
      createdAt: s.startedAt,
    }));
    s.world.eventMetadata.push(
      ...(output.newEvents ?? []).map((title) => ({ title, createdAt: now() })),
    );
    s.world.events.push(...(output.newEvents ?? []));
    s.revealedDates ??= s.revealedInfo.map(() => s.startedAt);
    s.revealedDates.push(...(output.revealedInfo ?? []).map(() => now()));
    s.revealedInfo.push(...(output.revealedInfo ?? []));
    // When this turn ends the session the candidate can no longer reply, so the
    // manager closes instead of asking a follow-up that would read as unanswered.
    const ending = shouldEnd(s);
    s.messages.push({
      id: randomUUID(),
      role: "manager",
      text: ending
        ? "Thanks — that gives me what I need for now. Please select Finish assessment to submit your work for review."
        : output.reply,
      createdAt: now(),
      turn,
    });
    if (ending) s.status = "ready";
    await db.query(
      "UPDATE proofskill_hiring_session SET payload=$2 WHERE id=$1",
      [s.id, JSON.stringify(s)],
    );
    return candidateSafe(s);
  });
}
export async function completeSimulation(
  id: string,
  token: string | { owner: string },
  call?: ModelCall,
) {
  return transaction(async (db) => {
    let s: Session;
    // HR may evaluate an attempt that monitoring closed before its turns or deadline ended.
    let closedByMonitoring = false;
    if (typeof token === "string")
      s = await candidateSession(db, id, token, true, true);
    else {
      const q = await db.query(
        "SELECT s.payload FROM proofskill_hiring_session s JOIN proofskill_hiring_assessment a ON a.id=(s.payload->>'assessmentId') WHERE s.id=$1 AND a.owner_id=$2 FOR UPDATE OF s",
        [id, token.owner],
      );
      if (!q.rows[0]) throw missing();
      s = SessionSchema.parse(q.rows[0].payload);
      if (s.demo) throw missing();
      const monitoring = await db.query(
        "SELECT disqualified FROM proofskill_monitoring_state WHERE invite_id=$1",
        [s.inviteId],
      );
      closedByMonitoring = monitoring.rows[0]?.disqualified === true;
    }

    if (s.status === "completed") return { submitted: true };
    if (!shouldEnd(s) && !closedByMonitoring)
      throw new AccountError("Complete the simulation before submitting.", 409);
    const evaluation = await evaluateCandidateSession(
      s,
      scopedModel(
        typeof token === "string"
          ? "invite:" + hashToken(token)
          : "hr:" + token.owner,
        call ?? providerCall,
      ),
    );
    const report: Report = {
      ...evaluation,
      ...weightedScore(evaluation, s.blueprint),
      id: randomUUID(),
      sessionId: s.id,
      assessmentId: s.assessmentId,
      notes: "",
      reviewed: false,
      decision: "undecided",
      createdAt: now(),
      demo: s.demo,
    };
    await db.query(
      "INSERT INTO proofskill_hiring_report(id,session_id,assessment_id,payload) VALUES($1,$2,$3,$4)",
      [report.id, s.id, s.assessmentId, JSON.stringify(report)],
    );
    s.status = "completed";
    s.completedAt = new Date(
      Math.min(Date.now(), Date.parse(s.deadline)),
    ).toISOString();
    s.reportId = report.id;
    await db.query(
      "UPDATE proofskill_hiring_session SET payload=$2 WHERE id=$1",
      [s.id, JSON.stringify(s)],
    );
    const iq = await db.query(
      "SELECT payload FROM proofskill_hiring_invite WHERE id=$1",
      [s.inviteId],
    );
    await db.query(
      "UPDATE proofskill_hiring_invite SET payload=$2 WHERE id=$1",
      [
        s.inviteId,
        JSON.stringify({ ...iq.rows[0].payload, status: "completed" }),
      ],
    );
    return { submitted: true };
  });
}
export async function getReport(owner: string, id: string) {
  return transaction(async (db) => {
    const q = await db.query(
      "SELECT r.payload FROM proofskill_hiring_report r JOIN proofskill_hiring_assessment a ON a.id=r.assessment_id WHERE r.id=$1 AND a.owner_id=$2 AND COALESCE((r.payload->>'demo')::boolean,false)=false",
      [id, owner],
    );
    if (!q.rows[0]) throw missing();
    const report = ReportSchema.parse(q.rows[0].payload);
    const sq = await db.query(
      "SELECT payload FROM proofskill_hiring_session WHERE id=$1",
      [report.sessionId],
    );
    const session = SessionSchema.parse(sq.rows[0].payload);
    const iq = await db.query(
      "SELECT payload FROM proofskill_hiring_invite WHERE id=$1",
      [session.inviteId],
    );
    return { report, session, candidate: iq.rows[0].payload };
  });
}
export async function reviewReport(
  owner: string,
  id: string,
  review: { notes: string; reviewed: boolean; decision: Report["decision"] },
) {
  return transaction(async (db) => {
    const q = await db.query(
      "SELECT r.payload FROM proofskill_hiring_report r JOIN proofskill_hiring_assessment a ON a.id=r.assessment_id WHERE r.id=$1 AND a.owner_id=$2 AND COALESCE((r.payload->>'demo')::boolean,false)=false FOR UPDATE OF r",
      [id, owner],
    );
    if (!q.rows[0]) throw missing();
    const report = { ...ReportSchema.parse(q.rows[0].payload), ...review };
    await db.query(
      "UPDATE proofskill_hiring_report SET payload=$2 WHERE id=$1",
      [id, JSON.stringify(report)],
    );
    const sq = await db.query(
      "SELECT invite_id FROM proofskill_hiring_session WHERE id=$1",
      [report.sessionId],
    );
    const iq = await db.query(
      "SELECT payload FROM proofskill_hiring_invite WHERE id=$1 FOR UPDATE",
      [sq.rows[0].invite_id],
    );
    await db.query(
      "UPDATE proofskill_hiring_invite SET payload=$2 WHERE id=$1",
      [
        sq.rows[0].invite_id,
        JSON.stringify({
          ...iq.rows[0].payload,
          status: review.reviewed ? "reviewed" : "completed",
        }),
      ],
    );
    return report;
  });
}
export async function dashboard(owner: string) {
  const assessments = await listAssessments(owner);
  const details = await Promise.all(
    assessments.map((a) => assessmentDetails(owner, a.id)),
  );
  const candidates = details.flatMap((d) =>
    d.candidates.map((c) => ({
      ...c,
      position: d.assessment.blueprint.title,
      version: d.assessment.version,
    })),
  );
  const q = await accountDatabase().query(
    "SELECT r.payload FROM proofskill_hiring_report r JOIN proofskill_hiring_assessment a ON a.id=r.assessment_id WHERE a.owner_id=$1 AND COALESCE((r.payload->>'demo')::boolean,false)=false",
    [owner],
  );
  const reports = q.rows.map((r) => ReportSchema.parse(r.payload));
  return {
    assessments,
    candidates,
    reports,
    counts: {
      activePositions: new Set(
        assessments
          .filter((a) => a.status === "published")
          .map((a) => a.lineageId),
      ).size,
      publishedAssessments: assessments.filter((a) => a.status === "published")
        .length,
      invitedCandidates: new Set(
        candidates.map((c) => c.candidateEmail.trim().toLowerCase()),
      ).size,
      completedSimulations: candidates.filter((c) =>
        ["completed", "reviewed"].includes(c.status),
      ).length,
      awaitingReview: reports.filter((r) => !r.reviewed).length,
    },
    activity: [
      ...assessments.map((a) => ({
        id: a.id,
        text: `${a.blueprint.title} · ${a.status} · v${a.version}`,
        time: a.publishedAt ?? a.createdAt,
        demo: a.demo,
      })),
      ...candidates.map((c) => ({
        id: c.id,
        text: `${c.candidateName} · ${c.status}`,
        time: c.completedAt ?? c.startedAt ?? c.createdAt,
        demo: c.demo,
      })),
    ]
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 15),
  };
}

export async function saveCandidateDraft(
  id: string,
  token: string,
  draft: string,
  expectedTurns: number,
) {
  return transaction(async (db) => {
    const s = await candidateSession(db, id, token, true);
    if (s.status !== "active" || s.turns !== expectedTurns)
      throw new AccountError(
        "The session changed. Refresh to restore it.",
        409,
      );
    s.draft = draft;
    await db.query(
      "UPDATE proofskill_hiring_session SET payload=$2 WHERE id=$1",
      [id, JSON.stringify(s)],
    );
    return { saved: true };
  });
}
