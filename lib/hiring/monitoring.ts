import "server-only";
import type { PoolClient } from "pg";
import { z } from "zod";
import { monitoringPolicySchema } from "@/lib/b2b/monitoring-contract";
import { accountDatabase } from "@/lib/account/database";
import { transaction, hashToken, ownedAssessment } from "./store";
import { HiringError } from "./error";
import { defaultMonitoring, monitoringNotice } from "./monitoring-policy";

export const eventBatchSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            kind: z.enum([
              "fullscreen-exit",
              "page-hidden",
              "window-blur",
              "camera-ended",
              "screen-ended",
              "clipboard-blocked",
            ]),
            occurredAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
type InviteRecord = {
  id: string;
  assessmentId: string;
  sessionId: string | null;
  monitoring?: unknown;
};
export async function monitoringInvite(db: PoolClient, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new HiringError("This invitation is unavailable.", 404);
  const q = await db.query(
    "SELECT payload FROM proofskill_hiring_invite WHERE token_hash=$1 FOR UPDATE",
    [hashToken(token)],
  );
  if (!q.rows[0] || q.rows[0].payload.demo)
    throw new HiringError("This invitation is unavailable.", 404);
  return q.rows[0].payload as InviteRecord;
}
function policyFor(i: InviteRecord) {
  return i.monitoring === undefined
    ? defaultMonitoring()
    : monitoringPolicySchema.parse(i.monitoring);
}
async function stateFor(db: PoolClient, i: InviteRecord) {
  const p = policyFor(i);
  await db.query(
    "INSERT INTO proofskill_monitoring_state(invite_id,policy_version) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [i.id, p.version],
  );
  const q = await db.query(
    "SELECT * FROM proofskill_monitoring_state WHERE invite_id=$1 FOR UPDATE",
    [i.id],
  );
  return q.rows[0];
}
const safeState = (s: { warnings: number; disqualified: boolean }) => ({
  fullscreenWarnings: s.warnings,
  disqualified: s.disqualified,
});
export async function assertMonitoring(
  db: PoolClient,
  i: InviteRecord,
  requireReady = true,
) {
  if (!policyFor(i).enabled) return;
  const s = await stateFor(db, i);
  if (s.disqualified)
    throw new HiringError("This assessment has been disqualified.", 410);
  if (
    requireReady &&
    (!s.consent ||
      !s.ready_until ||
      new Date(s.ready_until).getTime() <= Date.now())
  )
    throw new HiringError("Restore monitoring checks before continuing.", 403);
}
export async function monitoringStatus(token: string) {
  return transaction(async (db) => {
    const i = await monitoringInvite(db, token),
      policy = policyFor(i),
      s = await stateFor(db, i);
    if (i.sessionId && !s.disqualified) {
      const q = await db.query(
        "SELECT payload FROM proofskill_hiring_session WHERE id=$1",
        [i.sessionId],
      );
      if (
        !q.rows[0] ||
        q.rows[0].payload.status === "completed" ||
        Date.parse(q.rows[0].payload.deadline) <= Date.now()
      )
        throw new HiringError("This session is archived.", 410);
    }
    return { policy, state: safeState(s) };
  });
}
export async function saveMonitoringConsent(
  token: string,
  accepted: boolean,
  version: number,
) {
  return transaction(async (db) => {
    const i = await monitoringInvite(db, token);
    if (accepted) await activeInvite(db, i);
    const p = policyFor(i),
      s = await stateFor(db, i);
    if (p.version !== version)
      throw new HiringError("Monitoring requirements changed. Refresh.", 409);
    if (s.disqualified && accepted)
      throw new HiringError("This assessment has been disqualified.", 410);
    await db.query(
      "UPDATE proofskill_monitoring_state SET consent=$2,consent_at=now(),ready_until=NULL WHERE invite_id=$1",
      [i.id, accepted],
    );
    await db.query(
      "INSERT INTO proofskill_monitoring_consent(invite_id,policy_version,accepted) VALUES($1,$2,$3)",
      [i.id, version, accepted],
    );
    return { saved: true };
  });
}
async function activeInvite(db: PoolClient, i: InviteRecord) {
  if (i.sessionId) {
    const q = await db.query(
      "SELECT payload FROM proofskill_hiring_session WHERE id=$1",
      [i.sessionId],
    );
    if (
      !q.rows[0] ||
      q.rows[0].payload.status === "completed" ||
      Date.parse(q.rows[0].payload.deadline) <= Date.now()
    )
      throw new HiringError("This session is archived.", 410);
  } else {
    const q = await db.query(
      "SELECT payload FROM proofskill_hiring_assessment WHERE id=$1",
      [i.assessmentId],
    );
    if (q.rows[0]?.payload.status !== "published")
      throw new HiringError("This invitation is no longer available.", 410);
  }
}
export async function confirmMonitoringReady(
  token: string,
  version: number,
  warnings: number,
) {
  return transaction(async (db) => {
    const i = await monitoringInvite(db, token);
    await activeInvite(db, i);
    const s = await stateFor(db, i),
      p = policyFor(i);
    if (s.disqualified)
      throw new HiringError("This assessment has been disqualified.", 410);
    if (!s.consent || p.version !== version || s.warnings !== warnings)
      throw new HiringError(
        "Monitoring status changed. Restore checks and retry.",
        409,
      );
    await db.query(
      "UPDATE proofskill_monitoring_state SET ready_until=now()+interval '45 seconds' WHERE invite_id=$1",
      [i.id],
    );
    return { saved: true, state: safeState(s) };
  });
}
export async function recordMonitoringEvents(
  token: string,
  sessionId: string,
  events: z.infer<typeof eventBatchSchema>["events"],
) {
  return transaction(async (db) => {
    const i = await monitoringInvite(db, token);
    if (i.sessionId !== sessionId)
      throw new HiringError("This session is unavailable.", 404);
    const q = await db.query(
      "SELECT payload FROM proofskill_hiring_session WHERE id=$1 AND invite_id=$2 FOR UPDATE",
      [sessionId, i.id],
    );
    if (!q.rows[0]) throw new HiringError("This session is unavailable.", 404);
    const s = await stateFor(db, i);
    if (!policyFor(i).enabled)
      throw new HiringError(
        "Monitoring is not required for this attempt.",
        409,
      );
    // Retries after terminal closure must acknowledge receipts, without reopening task access.
    let added = 0,
      interrupts = false;
    for (const e of events) {
      const stamp = Date.parse(e.occurredAt);
      if (
        stamp < Date.parse(q.rows[0].payload.startedAt) - 60000 ||
        stamp > Date.now() + 60000
      )
        throw new HiringError("Invalid activity timestamp.", 400);
      const prior = await db.query(
        "SELECT kind,occurred_at FROM proofskill_monitoring_event WHERE invite_id=$1 AND id=$2",
        [i.id, e.id],
      );
      if (prior.rows[0]) {
        if (
          prior.rows[0].kind !== e.kind ||
          new Date(prior.rows[0].occurred_at).getTime() !== stamp
        )
          throw new HiringError("Activity event ID was reused.", 409);
        continue;
      }
      if (
        q.rows[0].payload.status === "completed" ||
        Date.parse(q.rows[0].payload.deadline) <= Date.now()
      )
        throw new HiringError("This session is archived.", 410);
      const rate = await db.query(
        "SELECT count(*)::int AS n FROM proofskill_monitoring_event WHERE invite_id=$1 AND received_at>now()-interval '1 minute'",
        [i.id],
      );
      if (rate.rows[0].n >= 120)
        throw new HiringError("Too many activity signals. Retry shortly.", 429);
      await db.query(
        "INSERT INTO proofskill_monitoring_event(invite_id,id,kind,occurred_at) VALUES($1,$2,$3,$4)",
        [i.id, e.id, e.kind, e.occurredAt],
      );
      if (e.kind === "fullscreen-exit") added++;
      if (e.kind !== "clipboard-blocked") interrupts = true;
    }
    const count = Math.min(3, s.warnings + added),
      closed = s.disqualified || count >= 3;
    await db.query(
      "UPDATE proofskill_monitoring_state SET warnings=$2,disqualified=$3,ready_until=CASE WHEN $4 THEN NULL ELSE ready_until END WHERE invite_id=$1",
      [i.id, count, closed, interrupts || closed],
    );
    return {
      saved: true,
      state: { fullscreenWarnings: count, disqualified: closed },
    };
  });
}
export async function assessmentMonitoring(owner: string, id: string) {
  return transaction(async (db) => ({
    policy:
      (await ownedAssessment(db, id, owner)).monitoring ?? defaultMonitoring(),
  }));
}
export async function updateAssessmentMonitoring(
  owner: string,
  id: string,
  input: { version: number; enabled: boolean; restrictClipboard: boolean },
) {
  return transaction(async (db) => {
    const a = await ownedAssessment(db, id, owner, true),
      p = a.monitoring ?? defaultMonitoring();
    if (a.status !== "draft")
      throw new HiringError(
        "Monitoring is locked after publication. Create a new draft version to change it.",
        409,
      );
    if (p.version !== input.version)
      throw new HiringError(
        "Monitoring settings changed. Refresh and retry.",
        409,
      );
    a.monitoring = {
      ...input,
      version: p.version + 1,
      notice: monitoringNotice,
    };
    await db.query(
      "UPDATE proofskill_hiring_assessment SET payload=$2 WHERE id=$1",
      [id, JSON.stringify(a)],
    );
    return { policy: a.monitoring };
  });
}
export async function hrMonitoringEvidence(owner: string, id: string) {
  await assessmentMonitoring(owner, id);
  const q = await accountDatabase().query(
    "SELECT i.id AS invite_id,i.payload->>'candidateName' AS candidate_name,m.warnings,m.disqualified,m.consent,m.consent_at,(SELECT count(*)::int FROM proofskill_monitoring_event e WHERE e.invite_id=i.id) AS activity_count FROM proofskill_hiring_invite i LEFT JOIN proofskill_monitoring_state m ON m.invite_id=i.id WHERE i.assessment_id=$1",
    [id],
  );
  return q.rows;
}
