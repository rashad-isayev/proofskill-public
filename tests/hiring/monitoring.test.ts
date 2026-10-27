import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { listCandidates } from "../../lib/candidates/store";
import { accountDatabase } from "../../lib/account/database";
import { demoBlueprint } from "../fixtures/hiring-data";
import {
  saveAssessment,
  createInvite,
  startSimulation,
  restoreSimulation,
  respondSimulation,
  saveCandidateDraft,
  completeSimulation,
  inviteEntry,
} from "../../lib/hiring/store";
import {
  assessmentMonitoring,
  updateAssessmentMonitoring,
  monitoringStatus,
  saveMonitoringConsent,
  confirmMonitoringReady,
  recordMonitoringEvents,
  hrMonitoringEvidence,
} from "../../lib/hiring/monitoring";
import type { Session } from "../../lib/hiring/internal-contracts";
const owner = "monitoring-test-" + randomUUID();
after(async () => {
  const db = accountDatabase();
  await db.query(
    "DELETE FROM proofskill_candidate_assignment WHERE candidate_id IN (SELECT id FROM proofskill_candidate WHERE owner_id=$1)",
    [owner],
  );
  await db.query("DELETE FROM proofskill_candidate WHERE owner_id=$1", [owner]);
  await db.query(
    "DELETE FROM proofskill_hiring_report WHERE assessment_id IN (SELECT id FROM proofskill_hiring_assessment WHERE owner_id=$1)",
    [owner],
  );
  await db.query(
    "DELETE FROM proofskill_hiring_session WHERE invite_id IN (SELECT id FROM proofskill_hiring_invite WHERE assessment_id IN (SELECT id FROM proofskill_hiring_assessment WHERE owner_id=$1))",
    [owner],
  );
  await db.query(
    "DELETE FROM proofskill_hiring_invite WHERE assessment_id IN (SELECT id FROM proofskill_hiring_assessment WHERE owner_id=$1)",
    [owner],
  );
  await db.query("DELETE FROM proofskill_hiring_assessment WHERE owner_id=$1", [
    owner,
  ]);
  await db.end();
});
test("monitoring is frozen on publication, owner scoped, consent gated and server terminated idempotently", async () => {
  const draft = await saveAssessment(owner, {
    blueprint: demoBlueprint,
    status: "draft",
  });
  await assert.rejects(() => assessmentMonitoring("another-owner", draft.id));
  const initial = await assessmentMonitoring(owner, draft.id);
  const configured = await updateAssessmentMonitoring(owner, draft.id, {
    version: initial.policy.version,
    enabled: true,
    restrictClipboard: true,
  });
  await assert.rejects(() =>
    updateAssessmentMonitoring(owner, draft.id, {
      version: initial.policy.version,
      enabled: false,
      restrictClipboard: false,
    }),
  );
  await assert.rejects(() =>
    saveAssessment(owner, {
      id: draft.id,
      baseVersion: draft.version,
      blueprint: demoBlueprint,
      status: "published",
      monitoring: {
        version: initial.policy.version,
        enabled: false,
        restrictClipboard: false,
      },
    }),
  );
  const published = await saveAssessment(owner, {
    id: draft.id,
    baseVersion: draft.version,
    blueprint: demoBlueprint,
    status: "published",
  });
  await assert.rejects(() =>
    updateAssessmentMonitoring(owner, published.id, {
      version: configured.policy.version,
      enabled: false,
      restrictClipboard: false,
    }),
  );
  const invite = await createInvite(
    owner,
    published.id,
    "Monitoring sample",
    "monitoring@example.test",
  );
  const other = await createInvite(
    owner,
    published.id,
    "Other sample",
    "other-monitoring@example.test",
  );
  const version = configured.policy.version;
  assert.equal((await monitoringStatus(invite.token)).policy.enabled, true);
  await assert.rejects(
    () =>
      startSimulation(invite.token, false, async () => {
        throw new Error("Provider must not be called");
      }),
    /Restore monitoring/,
  );
  await assert.rejects(() => saveMonitoringConsent(invite.token, true, 999));
  await saveMonitoringConsent(invite.token, true, version);
  await confirmMonitoringReady(invite.token, version, 0);
  await saveMonitoringConsent(invite.token, false, version);
  await assert.rejects(() => confirmMonitoringReady(invite.token, version, 0));
  await saveMonitoringConsent(invite.token, true, version);
  await confirmMonitoringReady(invite.token, version, 0);
  const id = randomUUID(),
    startedAt = new Date().toISOString();
  const s: Session = {
    id,
    inviteId: invite.id,
    assessmentId: published.id,
    assessmentVersion: published.version,
    blueprint: demoBlueprint,
    seed: "test-seed",
    familyId: demoBlueprint.families[0].id,
    world: {
      company: "Test Company",
      role: "Marketer",
      context: "Fictional monitoring integration test scenario.",
      facts: { visitors: 1000 },
      hiddenFacts: { secret: "Not candidate safe" },
      events: [],
      tools: ["Calculator"],
    },
    messages: [],
    evidence: [],
    revealedInfo: [],
    nextObjective: demoBlueprint.competencies[0].id,
    draft: "Preserve this draft.",
    requests: [],
    turns: 0,
    status: "active",
    startedAt,
    deadline: new Date(Date.now() + 900000).toISOString(),
    completedAt: null,
    reportId: null,
    demo: false,
  };
  await accountDatabase().query(
    "INSERT INTO proofskill_hiring_session(id,invite_id,payload) VALUES($1,$2,$3)",
    [id, invite.id, JSON.stringify(s)],
  );
  await accountDatabase().query(
    "UPDATE proofskill_hiring_invite SET payload=payload || $2::jsonb WHERE id=$1",
    [invite.id, JSON.stringify({ sessionId: id, status: "in progress" })],
  );
  // Metadata/draft writes remain available, but paused task content never crosses the server.
  await saveMonitoringConsent(invite.token, false, version);
  await assert.rejects(
    () => restoreSimulation(id, invite.token),
    /Restore monitoring/,
  );
  await assert.rejects(
    () => startSimulation(invite.token, true),
    /Restore monitoring/,
  );
  await saveCandidateDraft(id, invite.token, "Preserve this draft.", 0);
  assert.equal((await inviteEntry(invite.token)).sessionId, id);
  await saveMonitoringConsent(invite.token, true, version);
  await confirmMonitoringReady(invite.token, version, 0);
  await accountDatabase().query(
    "UPDATE proofskill_monitoring_state SET ready_until=now()-interval '1 second' WHERE invite_id=$1",
    [invite.id],
  );
  await assert.rejects(
    () => restoreSimulation(id, invite.token),
    /Restore monitoring/,
  );
  await confirmMonitoringReady(invite.token, version, 0);
  assert.equal(
    (await restoreSimulation(id, invite.token)).draft,
    "Preserve this draft.",
  );
  await assert.rejects(() =>
    recordMonitoringEvents(other.token, id, [
      { id: randomUUID(), kind: "fullscreen-exit", occurredAt: startedAt },
    ]),
  );
  const first = {
    id: randomUUID(),
    kind: "fullscreen-exit" as const,
    occurredAt: startedAt,
  };
  const delivered = await Promise.all([
    recordMonitoringEvents(invite.token, id, [first]),
    recordMonitoringEvents(invite.token, id, [first]),
  ]);
  assert.deepEqual(
    delivered.map((x) => x.state.fullscreenWarnings),
    [1, 1],
  );
  await assert.rejects(() =>
    recordMonitoringEvents(invite.token, id, [
      { ...first, kind: "page-hidden" },
    ]),
  );
  await assert.rejects(() => confirmMonitoringReady(invite.token, version, 0));
  await assert.rejects(
    () =>
      respondSimulation(
        id,
        invite.token,
        "A response",
        0,
        async () => {
          throw new Error("Provider must not be called");
        },
        randomUUID(),
      ),
    /Restore monitoring/,
  );
  await confirmMonitoringReady(invite.token, version, 1);
  assert.equal(
    (await restoreSimulation(id, invite.token)).draft,
    "Preserve this draft.",
  );
  assert(
    !JSON.stringify(await restoreSimulation(id, invite.token)).includes(
      "Not candidate safe",
    ),
  );
  const rest = [2, 3].map(() => ({
    id: randomUUID(),
    kind: "fullscreen-exit" as const,
    occurredAt: new Date().toISOString(),
  }));
  await recordMonitoringEvents(invite.token, id, rest);
  assert.deepEqual((await monitoringStatus(invite.token)).state, {
    fullscreenWarnings: 3,
    disqualified: true,
  });
  assert.deepEqual(
    (await recordMonitoringEvents(invite.token, id, rest)).state,
    { fullscreenWarnings: 3, disqualified: true },
  );
  assert.equal((await inviteEntry(invite.token)).status, "archived");
  for (const attempt of [
    () => restoreSimulation(id, invite.token),
    () => startSimulation(invite.token),
    () => startSimulation(invite.token, true),
    () => respondSimulation(id, invite.token, "reply", 0),
    () => saveCandidateDraft(id, invite.token, "overwrite", 0),
    () => completeSimulation(id, invite.token),
    () => confirmMonitoringReady(invite.token, version, 2),
  ])
    await assert.rejects(attempt);
  assert.equal(
    (await hrMonitoringEvidence(owner, published.id)).find(
      (x) => x.invite_id === invite.id,
    )?.activity_count,
    3,
  );
  assert.equal(
    (await listCandidates(owner)).candidates.find(
      (c) => c.email === "monitoring@example.test",
    )?.assignments[0].progress,
    "closed",
  );
  assert.equal(
    (await listCandidates(owner)).candidates.find(
      (c) => c.email === "monitoring@example.test",
    )?.decision,
    "pending-review",
  );
  const saved = await accountDatabase().query(
    "SELECT payload FROM proofskill_hiring_session WHERE id=$1",
    [id],
  );
  assert.equal(saved.rows[0].payload.draft, "Preserve this draft.");
  assert.equal(
    (await monitoringStatus(other.token)).state.fullscreenWarnings,
    0,
  );
  // Only the owning HR user can evaluate a monitoring-closed, unfinished attempt.
  await assert.rejects(() =>
    completeSimulation(id, { owner: "another-owner" }),
  );
  const evaluated = await completeSimulation(id, { owner }, async () => ({
    ratings: demoBlueprint.competencies.map((c) => ({
      competencyId: c.id,
      score: null,
      quotes: [],
      sufficiency: "insufficient",
      rationale:
        "No submitted evidence in this synthetic monitoring-closed attempt.",
    })),
    strengths: [],
    weaknesses: [],
    reasoningMistakes: [],
    contradictions: [],
    followUpTopics: ["Obtain actual work evidence."],
    uncertainty: "high",
  }));
  assert.equal(evaluated.submitted, true);
  const result = await accountDatabase().query(
    "SELECT payload FROM proofskill_hiring_report WHERE session_id=$1",
    [id],
  );
  assert.equal(result.rows.length, 1);
  assert(
    result.rows[0].payload.ratings.every(
      (r: { score: number | null }) => r.score === null,
    ),
  );
  // New versions may change policy without mutating old invitations.
  const next = await saveAssessment(owner, {
    id: published.id,
    baseVersion: published.version,
    blueprint: demoBlueprint,
    status: "draft",
    monitoring: { version, enabled: false, restrictClipboard: false },
  });
  assert.equal(next.monitoring?.enabled, false);
  assert.equal((await monitoringStatus(other.token)).policy.enabled, true);
});
