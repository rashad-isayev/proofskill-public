import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { HiringError } from "./error";
import type { ModelCall } from "./llm";

const context = new AsyncLocalStorage<string>();
let pool: Pool | undefined;
export function aiBudgetDatabase() {
  const connectionString =
    process.env.APP_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!connectionString)
    throw new HiringError(
      "AI usage protection is unavailable. Retry later.",
      503,
    );
  // Short, independent transactions count failed calls even if hiring work rolls back.
  // A separate small pool prevents provider-budget checks waiting on their own session locks.
  return (pool ??= new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  }));
}
const positive = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value <= 1000000
    ? value
    : fallback;
};
export function aiBudgetLimits(scope: string) {
  const hr = scope.startsWith("hr:");
  return {
    globalPerMinute: positive("AI_GLOBAL_CALLS_PER_MINUTE", 60),
    globalPerDay: positive("AI_GLOBAL_CALLS_PER_DAY", 2000),
    globalConcurrent: positive("AI_GLOBAL_CONCURRENT_CALLS", 4),
    scopedPerWindow: positive(
      hr ? "AI_HR_CALLS_PER_HOUR" : "AI_INVITE_CALLS_PER_MINUTE",
      hr ? 20 : 24,
    ),
    scopedWindowSeconds: hr ? 3600 : 60,
    scopedPerDay: positive(
      hr ? "AI_HR_CALLS_PER_DAY" : "AI_INVITE_CALLS_PER_DAY",
      hr ? 100 : 64,
    ),
    scopedConcurrent: hr ? 2 : 1,
  };
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export async function acquireAILease(
  scope: string,
  limits = aiBudgetLimits(scope),
  group = "provider",
) {
  const db = await aiBudgetDatabase().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "proofskill-ai-budget:" + group,
    ]);
    const now = new Date(
      (await db.query("SELECT clock_timestamp() AS now")).rows[0].now,
    ).getTime();
    const scopeKey = digest(scope),
      groupKey = digest(group);
    const windows: [string, number, number][] = [
      ["minute", 60, limits.globalPerMinute],
      ["day", 86400, limits.globalPerDay],
      [
        scopeKey + ":window",
        limits.scopedWindowSeconds,
        limits.scopedPerWindow,
      ],
      [scopeKey + ":day", 86400, limits.scopedPerDay],
    ];
    for (const [key, seconds, max] of windows) {
      const start = Math.floor(now / (seconds * 1000)) * seconds * 1000;
      const found = await db.query(
        "SELECT calls FROM proofskill_ai_budget WHERE bucket=$1 AND window_start=$2",
        [groupKey + ":" + key, new Date(start)],
      );
      if ((found.rows[0]?.calls ?? 0) >= max)
        throw new HiringError(
          "AI request limit reached. Your saved work is intact. Retry later.",
          429,
          Math.max(1, Math.ceil((start + seconds * 1000 - now) / 1000)),
        );
    }
    const active = await db.query(
      "SELECT scope_key,expires_at FROM proofskill_ai_lease WHERE group_key=$1 AND expires_at>$2",
      [groupKey, new Date(now)],
    );
    if (
      active.rows.length >= limits.globalConcurrent ||
      active.rows.filter((r) => r.scope_key === scopeKey).length >=
        limits.scopedConcurrent
    )
      throw new HiringError(
        "AI service is busy. Your saved work is intact. Retry shortly.",
        429,
        5,
      );
    await db.query(
      "DELETE FROM proofskill_ai_lease WHERE group_key=$1 AND expires_at<=$2",
      [groupKey, new Date(now)],
    );
    await db.query("DELETE FROM proofskill_ai_budget WHERE window_start<$1", [
      new Date(now - 172800000),
    ]);
    for (const [key, seconds] of windows) {
      const start = Math.floor(now / (seconds * 1000)) * seconds * 1000;
      await db.query(
        "INSERT INTO proofskill_ai_budget(bucket,window_start,calls) VALUES($1,$2,1) ON CONFLICT(bucket,window_start) DO UPDATE SET calls=proofskill_ai_budget.calls+1",
        [groupKey + ":" + key, new Date(start)],
      );
    }
    const id = randomUUID();
    await db.query(
      "INSERT INTO proofskill_ai_lease(id,group_key,scope_key,expires_at) VALUES($1,$2,$3,$4)",
      [id, groupKey, scopeKey, new Date(now + 90000)],
    );
    await db.query("COMMIT");
    return id;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    if (error instanceof HiringError) throw error;
    throw new HiringError(
      "AI usage protection is unavailable. Your saved work is intact. Retry later.",
      503,
    );
  } finally {
    db.release();
  }
}
export async function releaseAILease(id: string) {
  await aiBudgetDatabase().query(
    "DELETE FROM proofskill_ai_lease WHERE id=$1",
    [id],
  );
}
export async function withProviderBudget<T>(work: () => Promise<T>) {
  let id: string;
  try {
    id = await acquireAILease(context.getStore() ?? "unscoped");
  } catch (error) {
    if (error instanceof HiringError) throw error;
    throw new HiringError(
      "AI usage protection is unavailable. Your saved work is intact. Retry later.",
      503,
    );
  }
  try {
    return await work();
  } finally {
    // A failed release remains conservatively occupied until the lease expires.
    await releaseAILease(id).catch(() => undefined);
  }
}
export function scopedModel(scope: string, call: ModelCall): ModelCall {
  return (...args) => context.run(scope, () => call(...args));
}
