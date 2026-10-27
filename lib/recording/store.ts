import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { transaction, hashToken } from "@/lib/hiring/store";
import { accountDatabase } from "@/lib/account/database";
import { HiringError } from "@/lib/hiring/error";
import {
  recordingSchema,
  recordingStartSchema,
  recordingFinishSchema,
} from "./contracts";
import { readChunk, writeChunk, removeRecording } from "./storage";
import type { z } from "zod";

export function recordingPolicy() {
  const days = Number(process.env.RECORDING_RETENTION_DAYS);
  const configured = Number.isInteger(days) && days > 0 && days <= 365;
  const enabled =
    process.env.RECORDING_ENABLED === "true" &&
    configured &&
    !!process.env.RECORDING_LOCAL_DIRECTORY &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL;
  return {
    enabled,
    retentionDays: enabled ? days : null,
    notice: enabled
      ? `Camera and Entire Screen video will be recorded without audio and stored privately for ${days} days. Only your hiring reviewer can access it. Upload interruptions are labeled; recording does not determine hiring outcomes. Stop capture to withdraw consent. Previously saved recordings remain until the stated deletion deadline.`
      : "Recording is disabled. Camera and screen capture remain local previews; no video is uploaded.",
  };
}
const missing = () => new HiringError("This recording is unavailable.", 404);
async function sessionFor(
  db: PoolClient,
  token: string,
  sessionId: string,
  allowClosed = false,
) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw missing();
  const q = await db.query(
    `SELECT s.payload,s.invite_id,i.payload AS invitation,m.consent,m.policy_version,m.disqualified FROM proofskill_hiring_invite i
 JOIN proofskill_hiring_session s ON s.invite_id=i.id LEFT JOIN proofskill_monitoring_state m ON m.invite_id=i.id
 WHERE i.token_hash=$1 AND s.id=$2 AND COALESCE((i.payload->>'demo')::boolean,false)=false FOR UPDATE OF i,s`,
    [hashToken(token), sessionId],
  );
  const r = q.rows[0];
  if (!r) throw missing();
  if (
    !r.invitation.monitoring?.enabled ||
    !r.consent ||
    r.policy_version !== r.invitation.monitoring.version
  )
    throw new HiringError(
      "Current monitoring consent is required for recording.",
      403,
    );
  const expired = Date.now() >= Date.parse(r.payload.deadline);
  if (
    !allowClosed &&
    (r.disqualified || r.payload.status === "completed" || expired)
  )
    throw new HiringError("This assessment is closed.", 410);
  // Final queued chunks may finish after closure, within a bounded window.
  if (allowClosed && Date.now() > Date.parse(r.payload.deadline) + 300000)
    throw new HiringError("Recording upload window has ended.", 410);
  return r;
}
const projection = (r: Record<string, unknown>) =>
  recordingSchema.parse({
    id: r.id,
    source: r.source,
    mime: r.mime,
    status: r.status,
    chunks: Number(r.chunks ?? 0),
    bytes: Number(r.bytes ?? 0),
    createdAt: new Date(r.created_at as string).toISOString(),
    expiresAt: new Date(r.expires_at as string).toISOString(),
  });
async function totals(db: PoolClient, id: string) {
  return (
    await db.query(
      "SELECT count(*)::int AS chunks,COALESCE(sum(bytes),0)::bigint AS bytes FROM proofskill_recording_chunk WHERE recording_id=$1",
      [id],
    )
  ).rows[0];
}
async function recordFor(db: PoolClient, id: string) {
  const q = await db.query(
    "SELECT * FROM proofskill_recording WHERE id=$1 FOR UPDATE",
    [id],
  );
  const r = q.rows[0];
  if (!r || Date.now() >= new Date(r.expires_at).getTime()) throw missing();
  return r;
}
export async function startRecording(
  token: string,
  sessionId: string,
  input: z.infer<typeof recordingStartSchema>,
) {
  const p = recordingPolicy();
  if (!p.enabled) throw new HiringError("Recording is not configured.", 503);
  if (input.retentionDays !== p.retentionDays)
    throw new HiringError(
      "Recording disclosure changed. Reload before consenting.",
      409,
    );
  return transaction(async (db) => {
    await sessionFor(db, token, sessionId);
    const old = await db.query(
      "SELECT * FROM proofskill_recording WHERE session_id=$1 AND request_id=$2",
      [sessionId, input.requestId],
    );
    if (old.rows[0]) {
      const r = old.rows[0];
      if (r.source !== input.source || r.mime !== input.mime)
        throw new HiringError("Recording request ID was reused.", 409);
      return { recording: projection({ ...r, ...(await totals(db, r.id)) }) };
    }
    const count = await db.query(
      "SELECT count(*)::int AS n FROM proofskill_recording WHERE session_id=$1",
      [sessionId],
    );
    if (count.rows[0].n >= 20)
      throw new HiringError(
        "Recording segment limit reached. Contact the hiring team.",
        429,
      );
    const id = randomUUID();
    const q = await db.query(
      `INSERT INTO proofskill_recording(id,session_id,request_id,source,mime,expires_at,consent_notice) VALUES($1,$2,$3,$4,$5,now()+($6::integer*interval '1 day'),$7) RETURNING *`,
      [
        id,
        sessionId,
        input.requestId,
        input.source,
        input.mime,
        p.retentionDays,
        p.notice,
      ],
    );
    return { recording: projection(q.rows[0]) };
  });
}
export async function uploadChunk(
  token: string,
  id: string,
  sequence: number,
  data: Buffer,
) {
  if (!recordingPolicy().enabled)
    throw new HiringError("Recording is disabled.", 503);
  if (
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    sequence >= 300 ||
    !data.length ||
    data.length > 8388608
  )
    throw new HiringError("Invalid recording chunk size or sequence.", 400);
  const digest = createHash("sha256").update(data).digest("hex");
  return transaction(async (db) => {
    // Identify the session before acquiring locks in invitation -> session -> recording order.
    const lookup = await db.query(
      "SELECT session_id FROM proofskill_recording WHERE id=$1",
      [id],
    );
    if (!lookup.rows[0]) throw missing();
    await sessionFor(db, token, lookup.rows[0].session_id, true);
    const r = await recordFor(db, id);
    const old = await db.query(
      "SELECT sha256 FROM proofskill_recording_chunk WHERE recording_id=$1 AND sequence=$2",
      [id, sequence],
    );
    if (old.rows[0]) {
      if (old.rows[0].sha256 !== digest)
        throw new HiringError(
          "Recording chunk ID was reused with different content.",
          409,
        );
      return { saved: true };
    }
    if (r.status !== "recording")
      throw new HiringError("Recording has already been finalized.", 409);
    const sum = await db.query(
      `SELECT COALESCE(sum(c.bytes),0)::bigint AS bytes FROM proofskill_recording_chunk c JOIN proofskill_recording r ON r.id=c.recording_id WHERE r.session_id=$1`,
      [r.session_id],
    );
    if (Number(sum.rows[0].bytes) + data.length > 268435456)
      throw new HiringError("Assessment recording storage limit reached.", 413);
    const t = await totals(db, id);
    if (sequence !== t.chunks)
      throw new HiringError(
        "Recording chunk is out of order. Retry the previous chunk.",
        409,
      );
    if (
      sequence === 0 &&
      !(
        data[0] === 0x1a &&
        data[1] === 0x45 &&
        data[2] === 0xdf &&
        data[3] === 0xa3
      )
    )
      throw new HiringError("The recording must contain WebM video.", 400);
    await writeChunk(id, sequence, data);
    await db.query(
      "INSERT INTO proofskill_recording_chunk(recording_id,sequence,bytes,sha256) VALUES($1,$2,$3,$4)",
      [id, sequence, data.length, digest],
    );
    return { saved: true };
  });
}
export async function finishRecording(
  token: string,
  id: string,
  input: z.infer<typeof recordingFinishSchema>,
) {
  return transaction(async (db) => {
    const lookup = await db.query(
      "SELECT session_id FROM proofskill_recording WHERE id=$1",
      [id],
    );
    if (!lookup.rows[0]) throw missing();
    await sessionFor(db, token, lookup.rows[0].session_id, true);
    const r = await recordFor(db, id),
      t = await totals(db, id);
    const status =
      input.interrupted || t.chunks !== input.chunks || !t.chunks
        ? "interrupted"
        : "complete";
    if (r.status !== "recording" && r.status !== status)
      throw new HiringError("Recording finalization changed.", 409);
    await db.query(
      "UPDATE proofskill_recording SET status=$2,finalized_at=COALESCE(finalized_at,now()) WHERE id=$1",
      [id, status],
    );
    return { recording: projection({ ...r, ...t, status }) };
  });
}
export async function listRecordings(owner: string, assessmentId: string) {
  const db = accountDatabase();
  const a = await db.query(
    "SELECT id FROM proofskill_hiring_assessment WHERE id=$1 AND owner_id=$2",
    [assessmentId, owner],
  );
  if (!a.rows[0]) throw missing();
  const q = await db.query(
    `SELECT r.*,CASE WHEN r.status='recording' AND (s.payload->>'status'='completed' OR (s.payload->>'deadline')::timestamptz<=now() OR m.disqualified OR m.consent=false) THEN 'interrupted' ELSE r.status END AS display_status,i.payload->>'candidateName' AS candidate_name,(SELECT count(*)::int FROM proofskill_recording_chunk c WHERE c.recording_id=r.id) AS chunks,(SELECT COALESCE(sum(bytes),0) FROM proofskill_recording_chunk c WHERE c.recording_id=r.id) AS bytes FROM proofskill_recording r JOIN proofskill_hiring_session s ON s.id=r.session_id JOIN proofskill_hiring_invite i ON i.id=s.invite_id LEFT JOIN proofskill_monitoring_state m ON m.invite_id=i.id WHERE s.payload->>'assessmentId'=$1 AND r.expires_at>now() ORDER BY r.created_at DESC`,
    [assessmentId],
  );
  return {
    recordings: q.rows.map((r) => ({
      ...projection({ ...r, status: r.display_status }),
      candidateName: r.candidate_name,
      sessionId: r.session_id,
    })),
  };
}
export async function playback(owner: string, id: string) {
  return transaction(async (db) => {
    const r = await recordFor(db, id);
    const a = await db.query(
      `SELECT a.owner_id FROM proofskill_hiring_session s JOIN proofskill_hiring_assessment a ON a.id=s.payload->>'assessmentId' WHERE s.id=$1 AND a.owner_id=$2`,
      [r.session_id, owner],
    );
    if (!a.rows[0]) throw missing();
    const c = await db.query(
      "SELECT sequence,bytes,sha256 FROM proofskill_recording_chunk WHERE recording_id=$1 ORDER BY sequence",
      [id],
    );
    if (!c.rows.length) throw missing();
    const buffers = [];
    for (const chunk of c.rows) {
      const b = await readChunk(id, chunk.sequence);
      if (
        b.length !== chunk.bytes ||
        createHash("sha256").update(b).digest("hex") !== chunk.sha256
      )
        throw new HiringError("Recording storage is incomplete.", 503);
      buffers.push(b);
    }
    await db.query(
      "INSERT INTO proofskill_recording_access(recording_id,owner_id) VALUES($1,$2)",
      [id, owner],
    );
    return { data: Buffer.concat(buffers), mime: r.mime as string };
  });
}
export async function purgeExpiredRecordings() {
  return transaction(async (db) => {
    const q = await db.query(
      "SELECT id FROM proofskill_recording WHERE expires_at<=now() FOR UPDATE SKIP LOCKED",
    );
    for (const r of q.rows) {
      await removeRecording(r.id);
      await db.query("DELETE FROM proofskill_recording WHERE id=$1", [r.id]);
    }
    return q.rows.length;
  });
}
