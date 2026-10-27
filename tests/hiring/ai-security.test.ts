import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { demoRecords } from "../fixtures/hiring-data";
import { processAdaptiveTurn } from "../../lib/hiring/orchestration";
import {
  acquireAILease,
  releaseAILease,
  aiBudgetDatabase,
  aiBudgetLimits,
  scopedModel,
} from "../../lib/hiring/ai-budget";
import { providerCall } from "../../lib/hiring/llm";

const db = aiBudgetDatabase();
after(async () => {
  await db.end();
});
const limits = {
  ...aiBudgetLimits("hr:test"),
  globalPerMinute: 100,
  globalPerDay: 200,
  globalConcurrent: 10,
  scopedPerWindow: 100,
  scopedPerDay: 200,
  scopedConcurrent: 2,
};
function group() {
  return "security-test-" + randomUUID();
}
const limited = (error: unknown) =>
  error instanceof Error && "status" in error && error.status === 429;

test("AI private analysis cannot transfer rubric, evidence notes or hidden facts to the public reply model", async () => {
  const s = structuredClone(demoRecords("ai-isolation").candidates[0].session);
  s.blueprint.competencies[0].rubric["5"] =
    "Private calibration marker alpha bravo charlie delta";
  s.world.hiddenFacts.investigation_1 =
    "Stored investigation finding for this isolation test.";
  s.world.hiddenFacts.unrevealed = "Secret unrevealed information marker";
  s.evidence[0].note = "Private evidence note marker";
  let publicCalls = 0;
  const output = await processAdaptiveTurn(s, async (name, prompt, data) => {
    if (name === "turn_analysis")
      return {
        revealedKeys: ["investigation_1"],
        eventKeys: [],
        evidence: [],
        nextObjective: s.blueprint.competencies[0].id,
      };
    assert.equal(name, "manager_reply");
    publicCalls++;
    const serialized = JSON.stringify({ prompt, data });
    for (const secret of [
      "Private calibration marker",
      "Secret unrevealed information",
      "Private evidence note",
      '"rubric"',
      '"competencies"',
      '"hiddenFacts"',
      '"nextObjective"',
    ])
      assert(!serialized.includes(secret), secret);
    return { reply: "What would you investigate before making this decision?" };
  });
  assert.equal(publicCalls, 1);
  assert.equal(output.revealedInfo[0].title, "Company information");
  assert.deepEqual(Object.keys(output.revealedInfo[0].data), [
    "investigation_1",
  ]);
});

test("AI rejects private-analysis prose, fabricated disclosures and rubric echoes without fallback", async () => {
  const s = structuredClone(demoRecords("ai-injection").candidates[0].session);
  const secret = "Private calibration marker alpha bravo charlie delta";
  s.blueprint.competencies[0].rubric["5"] = secret;
  for (const extra of [
    { reply: secret },
    { revealedKeys: ["rubric"] },
    { eventKeys: ["fake_event"] },
  ]) {
    let attempts = 0;
    await assert.rejects(
      () =>
        processAdaptiveTurn(s, async (name) => {
          assert.equal(name, "turn_analysis");
          attempts++;
          return {
            revealedKeys: [],
            eventKeys: [],
            evidence: [],
            nextObjective: s.blueprint.competencies[0].id,
            ...extra,
          };
        }),
      /failed validation twice/,
    );
    assert.equal(attempts, 2);
  }
  let publicAttempts = 0;
  await assert.rejects(
    () =>
      processAdaptiveTurn(s, async (name) => {
        if (name === "turn_analysis")
          return {
            revealedKeys: [],
            eventKeys: [],
            evidence: [],
            nextObjective: s.blueprint.competencies[0].id,
          };
        publicAttempts++;
        return { reply: secret };
      }),
    /failed validation twice/,
  );
  assert.equal(publicAttempts, 2);
});

test("AI budgets enforce durable global/scoped counters and concurrent leases atomically", async () => {
  const g = group();
  const selected = { ...limits, globalConcurrent: 2, scopedConcurrent: 1 };
  const a = await acquireAILease("hr:a", selected, g);
  await assert.rejects(() => acquireAILease("hr:a", selected, g), limited);
  const b = await acquireAILease("hr:b", selected, g);
  await assert.rejects(() => acquireAILease("hr:c", selected, g), limited);
  await releaseAILease(a);
  await releaseAILease(b);
  const race = await Promise.allSettled(
    Array.from({ length: 5 }, () => acquireAILease("hr:same", selected, g)),
  );
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of race)
    if (r.status === "fulfilled") await releaseAILease(r.value);
    else assert(limited(r.reason));
  const dailyGroup = group();
  const daily = { ...limits, globalPerDay: 1 };
  await releaseAILease(await acquireAILease("hr:a", daily, dailyGroup));
  await assert.rejects(
    () => acquireAILease("hr:new-account", daily, dailyGroup),
    limited,
  );
  const scopedGroup = group();
  const scoped = { ...limits, scopedPerWindow: 1 };
  await releaseAILease(await acquireAILease("hr:a", scoped, scopedGroup));
  await assert.rejects(
    () => acquireAILease("hr:a", scoped, scopedGroup),
    limited,
  );
  await releaseAILease(await acquireAILease("hr:b", scoped, scopedGroup));
});

test("expired leases recover capacity; failed provider attempts consume quota and release active slots", async () => {
  const g = group();
  const first = await acquireAILease(
    "hr:a",
    { ...limits, globalConcurrent: 1 },
    g,
  );
  await db.query(
    "UPDATE proofskill_ai_lease SET expires_at=now()-interval '1 second' WHERE id=$1",
    [first],
  );
  const next = await acquireAILease(
    "hr:a",
    { ...limits, globalConcurrent: 1 },
    g,
  );
  await releaseAILease(next);
  const scope = "hr:failure-" + randomUUID();
  const oldLimit = process.env.AI_HR_CALLS_PER_HOUR;
  process.env.AI_HR_CALLS_PER_HOUR = "1";
  try {
    // No credentials or network needed: rawProviderCall rejects missing configuration.
    const oldKey = process.env.OPENAI_API_KEY,
      oldModel = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    try {
      const call = scopedModel(scope, providerCall);
      const { z } = await import("zod");
      await assert.rejects(
        () => call("test", "test", {}, z.object({})),
        /not configured/,
      );
      await assert.rejects(
        () => call("test", "test", {}, z.object({})),
        limited,
      );
    } finally {
      if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldKey;
      if (oldModel === undefined) delete process.env.OPENAI_MODEL;
      else process.env.OPENAI_MODEL = oldModel;
    }
    const { rows } = await db.query(
      "SELECT count(*)::int AS n FROM proofskill_ai_lease WHERE expires_at>now()",
    );
    assert.equal(rows[0].n, 0);
  } finally {
    if (oldLimit === undefined) delete process.env.AI_HR_CALLS_PER_HOUR;
    else process.env.AI_HR_CALLS_PER_HOUR = oldLimit;
  }
});

test("quota rejection is not retried as an invalid model output", async () => {
  const { structured } = await import("../../lib/hiring/llm");
  const { HiringError } = await import("../../lib/hiring/error");
  const { z } = await import("zod");
  let attempts = 0;
  await assert.rejects(
    () =>
      structured("test", "test", {}, z.object({}), undefined, async () => {
        attempts++;
        throw new HiringError("Synthetic quota limit", 429, 5);
      }),
    limited,
  );
  assert.equal(attempts, 1);
});
