import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { accountDatabase } from "../../lib/account/database";
import {
  importCandidates,
  listCandidates,
  assignCandidates,
  updateCandidateDecision,
} from "../../lib/candidates/store";
import {
  saveAssessment,
  createInvite,
  inviteEntry,
} from "../../lib/hiring/store";
import { candidateDDL } from "../../lib/candidates/schema";
import { demoBlueprint } from "../fixtures/hiring-data";
const owner = "directory-test-" + randomUUID(),
  other = "directory-other-" + randomUUID();
after(async () => {
  const db = accountDatabase();
  for (const o of [owner, other]) {
    await db.query(
      "DELETE FROM proofskill_candidate_assignment WHERE candidate_id IN (SELECT id FROM proofskill_candidate WHERE owner_id=$1)",
      [o],
    );
    await db.query("DELETE FROM proofskill_candidate WHERE owner_id=$1", [o]);
    await db.query("DELETE FROM proofskill_hiring_request WHERE owner_id=$1", [
      o,
    ]);
    await db.query(
      "DELETE FROM proofskill_hiring_invite WHERE assessment_id IN (SELECT id FROM proofskill_hiring_assessment WHERE owner_id=$1)",
      [o],
    );
    await db.query(
      "DELETE FROM proofskill_hiring_assessment WHERE owner_id=$1",
      [o],
    );
  }
  await db.end();
});
test("independent candidates, transactional bulk assignment, owner isolation and overall decisions", async () => {
  const input = {
    candidates: [
      { name: "First", email: "FIRST@example.test", position: "Analyst" },
      { name: "Second", email: "second@example.test", position: "" },
    ],
    requestId: randomUUID(),
  };
  const results = await Promise.all([
    importCandidates(owner, input),
    importCandidates(owner, input),
  ]);
  assert.equal(results[0].created, 2);
  assert.deepEqual(results[0], results[1]);
  assert.equal((await listCandidates(owner)).candidates.length, 2);
  assert.equal(
    (await importCandidates(owner, { ...input, requestId: randomUUID() }))
      .skipped.length,
    2,
  );
  assert.equal((await listCandidates(other)).candidates.length, 0);
  const a = await saveAssessment(owner, {
    blueprint: demoBlueprint,
    status: "published",
  });
  const draft = await saveAssessment(owner, {
    blueprint: demoBlueprint,
    status: "draft",
  });
  const cs = (await listCandidates(owner)).candidates;
  const batch = {
    candidateIds: cs.map((c) => c.id),
    assessmentId: a.id,
    assessmentVersion: a.version,
    requestId: randomUUID(),
  };
  await assert.rejects(() => assignCandidates(other, batch));
  await assert.rejects(() =>
    assignCandidates(owner, { ...batch, assessmentId: draft.id }),
  );
  await assert.rejects(() =>
    assignCandidates(owner, { ...batch, assessmentVersion: 99 }),
  );
  await assert.rejects(() =>
    assignCandidates(owner, {
      ...batch,
      candidateIds: [cs[0].id, randomUUID()],
    }),
  );
  assert(
    (await listCandidates(owner)).candidates.every(
      (c) => !c.assignments.length,
    ),
  );
  const assigned = await Promise.all([
    assignCandidates(owner, batch),
    assignCandidates(owner, batch),
  ]);
  assert.deepEqual(assigned, [
    { created: 2, skipped: 0 },
    { created: 2, skipped: 0 },
  ]);
  assert.deepEqual(
    await assignCandidates(owner, { ...batch, requestId: randomUUID() }),
    { created: 0, skipped: 2 },
  );
  let directory = await listCandidates(owner);
  for (const c of directory.candidates) {
    assert.equal(c.assignments.length, 1);
    assert.equal(c.assignments[0].progress, "invited");
    assert.equal(
      (await inviteEntry(c.assignments[0].invitePath!.split("/").at(-1)!))
        .status,
      "invited",
    );
  }
  await assert.rejects(() =>
    updateCandidateDecision(other, cs[0].id, {
      decision: "selected",
      revision: 0,
    }),
  );
  await updateCandidateDecision(owner, cs[0].id, {
    decision: "follow-up-required",
    revision: 0,
  });
  await assert.rejects(() =>
    updateCandidateDecision(owner, cs[0].id, {
      decision: "rejected",
      revision: 0,
    }),
  );
  const b = await saveAssessment(owner, {
    blueprint: demoBlueprint,
    status: "published",
  });
  await assignCandidates(owner, {
    ...batch,
    candidateIds: [cs[0].id],
    assessmentId: b.id,
    requestId: randomUUID(),
  });
  directory = await listCandidates(owner);
  assert.equal(
    directory.candidates.find((c) => c.id === cs[0].id)!.decision,
    "follow-up-required",
  );
  assert.equal(
    directory.candidates.find((c) => c.id === cs[0].id)!.assignments.length,
    2,
  );
  const old = await createInvite(
    owner,
    b.id,
    "Legacy third",
    "third@example.test",
    randomUUID(),
    b.version,
  );
  directory = await listCandidates(owner);
  assert.equal(
    directory.candidates.find((c) => c.email === "third@example.test")!
      .assignments.length,
    1,
  );
  await accountDatabase().query(candidateDDL);
  await accountDatabase().query(candidateDDL);
  assert.equal((await listCandidates(owner)).candidates.length, 3);
  assert.equal((await inviteEntry(old.token)).status, "invited");
  const direct = await accountDatabase().query(
    "SELECT token_hash,payload FROM proofskill_hiring_invite WHERE id=$1",
    [old.id],
  );
  assert(!JSON.stringify(direct.rows).includes(old.token));
});
