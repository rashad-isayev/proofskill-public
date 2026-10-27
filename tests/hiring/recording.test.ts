import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveAssessment, createInvite } from "../../lib/hiring/store";
import { accountDatabase } from "../../lib/account/database";
import { demoBlueprint } from "../fixtures/hiring-data";
import {
  startRecording,
  uploadChunk,
  finishRecording,
  playback,
  listRecordings,
  purgeExpiredRecordings,
  recordingPolicy,
} from "../../lib/recording/store";
const owner = "recording-test-" + randomUUID();
let folder = "";
after(async () => {
  const db = accountDatabase();
  await db.query(
    "DELETE FROM proofskill_candidate_assignment WHERE candidate_id IN (SELECT id FROM proofskill_candidate WHERE owner_id=$1)",
    [owner],
  );
  await db.query("DELETE FROM proofskill_candidate WHERE owner_id=$1", [owner]);
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
  if (folder) await rm(folder, { recursive: true, force: true });
  await db.end();
});
test("private recording uploads are ordered, idempotent, owner scoped, bounded, finalized and expired", async () => {
  folder = await mkdtemp(join(tmpdir(), "proofskill-recording-test-"));
  process.env.RECORDING_ENABLED = "false";
  assert.equal(recordingPolicy().enabled, false);
  process.env.RECORDING_ENABLED = "true";
  process.env.RECORDING_LOCAL_DIRECTORY = folder;
  delete process.env.RECORDING_RETENTION_DAYS;
  assert.equal(recordingPolicy().enabled, false);
  // A test-only retention configuration; this is not a product policy choice.
  process.env.RECORDING_RETENTION_DAYS = "1";
  assert.equal(recordingPolicy().enabled, true);
  const assessment = await saveAssessment(owner, {
    blueprint: demoBlueprint,
    status: "published",
    monitoring: { enabled: true, restrictClipboard: true },
  });
  const invite = await createInvite(
    owner,
    assessment.id,
    "Recording fixture",
    "recording@example.test",
  );
  const sessionId = randomUUID();
  const db = accountDatabase();
  await db.query(
    "INSERT INTO proofskill_hiring_session(id,invite_id,payload) VALUES($1,$2,$3)",
    [
      sessionId,
      invite.id,
      JSON.stringify({
        assessmentId: assessment.id,
        status: "active",
        deadline: new Date(Date.now() + 900000).toISOString(),
      }),
    ],
  );
  await db.query(
    "INSERT INTO proofskill_monitoring_state(invite_id,policy_version,consent) VALUES($1,$2,true)",
    [invite.id, assessment.monitoring!.version],
  );
  const input = {
    source: "camera" as const,
    mime: "video/webm" as const,
    requestId: randomUUID(),
    retentionDays: 1,
    accepted: true as const,
  };
  await assert.rejects(() =>
    startRecording(invite.token, sessionId, { ...input, retentionDays: 2 }),
  );
  const { recording } = await startRecording(invite.token, sessionId, input);
  assert.equal(
    (await startRecording(invite.token, sessionId, input)).recording.id,
    recording.id,
  );
  await assert.rejects(() =>
    startRecording(invite.token, sessionId, { ...input, source: "screen" }),
  );
  const header = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]);
  await assert.rejects(() =>
    uploadChunk("0".repeat(64), recording.id, 0, header),
  );
  await assert.rejects(() =>
    uploadChunk(invite.token, recording.id, 1, header),
  );
  await assert.rejects(() =>
    uploadChunk(invite.token, recording.id, 0, Buffer.from("not video")),
  );
  await uploadChunk(invite.token, recording.id, 0, header);
  await uploadChunk(invite.token, recording.id, 0, header);
  await assert.rejects(() =>
    uploadChunk(
      invite.token,
      recording.id,
      0,
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x03]),
    ),
  );
  await assert.rejects(() =>
    uploadChunk(invite.token, recording.id, 1, Buffer.alloc(8388609)),
  );
  await uploadChunk(invite.token, recording.id, 1, Buffer.from([3, 4]));
  assert.equal(
    (
      await finishRecording(invite.token, recording.id, {
        chunks: 2,
        interrupted: false,
      })
    ).recording.status,
    "complete",
  );
  assert.equal(
    (await listRecordings(owner, assessment.id)).recordings[0].bytes,
    8,
  );
  await assert.rejects(() => listRecordings("another-owner", assessment.id));
  await assert.rejects(() => playback("another-owner", recording.id));
  assert.deepEqual(
    (await playback(owner, recording.id)).data,
    Buffer.concat([header, Buffer.from([3, 4])]),
  );
  await assert.rejects(() =>
    uploadChunk(invite.token, recording.id, 2, header),
  );
  const second = await startRecording(invite.token, sessionId, {
    ...input,
    source: "screen",
    requestId: randomUUID(),
  });
  await uploadChunk(invite.token, second.recording.id, 0, header);
  assert.equal(
    (
      await finishRecording(invite.token, second.recording.id, {
        chunks: 2,
        interrupted: false,
      })
    ).recording.status,
    "interrupted",
  );
  await db.query(
    "UPDATE proofskill_monitoring_state SET consent=false WHERE invite_id=$1",
    [invite.id],
  );
  await assert.rejects(() =>
    uploadChunk(invite.token, second.recording.id, 1, header),
  );
  await db.query(
    "UPDATE proofskill_recording SET expires_at=now()-interval '1 second' WHERE id=$1",
    [recording.id],
  );
  await assert.rejects(() => playback(owner, recording.id));
  assert.equal(await purgeExpiredRecordings(), 1);
  assert.equal(
    (await listRecordings(owner, assessment.id)).recordings.length,
    1,
  );
});
