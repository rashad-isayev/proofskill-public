import { test } from "node:test";
import assert from "node:assert/strict";
import { demoBlueprint, demoRecords } from "../fixtures/hiring-data";
import {
  deriveScenarioMetrics,
  computeMetrics,
  validateMetrics,
  validateBlueprint,
  validateTurn,
  validateEvaluation,
  weightedScore,
  candidateSafe,
  seededNumbers,
  shouldEnd,
} from "../../lib/hiring/validation";
import {
  TurnResultSchema,
  SessionSchema,
  ReportSchema,
} from "../../lib/hiring/internal-contracts";
test("derived CVR, CAC, ROAS and contribution are deterministic and validated", () => {
  assert.deepEqual(computeMetrics(10000, 250, 5000, 100), {
    visitors: 10000,
    orders: 250,
    spend: 5000,
    orderValue: 100,
    revenue: 25000,
    cvr: 2.5,
    cac: 20,
    roas: 5,
    contribution: 20000,
  });
  assert.throws(() => computeMetrics(0, 1, 2, 3));
  assert.throws(() =>
    validateMetrics({ ...computeMetrics(10000, 250, 5000, 100), roas: 9 }),
  );
  for (let i = 0; i < 100; i++)
    validateMetrics(seededNumbers(String(i), demoBlueprint.families[0]));
});
test("published family comparability requires identical difficulty, competency IDs and weights", () => {
  assert.equal(validateBlueprint(demoBlueprint).competencies.length, 4);
  const invalid = structuredClone(demoBlueprint);
  invalid.families[1].difficulty.hiddenFacts = 3;
  assert.throws(() => validateBlueprint(invalid));
  invalid.families[1].difficulty.hiddenFacts = 2;
  invalid.competencies[0].weight = 0.9;
  assert.throws(() => validateBlueprint(invalid));
});
test("candidate projection excludes rubric, evidence, hidden world data, seed and objective recursively", () => {
  const s = demoRecords("test").candidates[0].session;
  SessionSchema.parse(s);
  const payload = JSON.stringify(candidateSafe(s));
  for (const key of [
    "hiddenFacts",
    "evidence",
    "nextObjective",
    "blueprint",
    "seed",
    "rubric",
    "ratings",
    "assessmentVersion",
  ])
    assert.equal(payload.includes('"' + key + '"'), false);
});
test("turn validator rejects fabricated evidence, altered facts and new contradictory events", () => {
  const s = demoRecords("test").candidates[0].session;
  const valid = TurnResultSchema.parse({
    reply: "What would you investigate next?",
    evidence: [
      {
        competencyId: "analysis",
        quote: s.messages[1].text,
        note: "Evidence inquiry",
      },
    ],
    revealedInfo: [],
    newEvents: [],
    nextObjective: "judgment",
    shouldEnd: false,
  });
  validateTurn(valid, s);
  assert.throws(() =>
    validateTurn(
      {
        ...valid,
        evidence: [
          {
            competencyId: "analysis",
            quote: "Invented candidate response",
            note: "fake",
          },
        ],
      },
      s,
    ),
  );
  assert.throws(() =>
    validateTurn(
      { ...valid, revealedInfo: [{ title: "Metrics", data: { spend: -999 } }] },
      s,
    ),
  );
  assert.throws(() => validateTurn({ ...valid, reply: s.messages[0].text }, s));
  assert.throws(() =>
    validateTurn({ ...valid, reply: "Your score is 5 / 5" }, s),
  );
  assert.throws(() =>
    validateTurn({ ...valid, reply: "The spend is 999999999" }, s),
  );
  assert.throws(() =>
    validateTurn({ ...valid, newEvents: ["Revenue is now negative."] }, s),
  );
  assert.throws(() =>
    TurnResultSchema.parse({
      ...valid,
      world: { facts: { spend: 0 } },
      score: 5,
    }),
  );
});
test("missing evidence becomes null and weighted coverage excludes it", () => {
  const { session: s, report: r } = demoRecords("test").candidates[0];
  ReportSchema.parse(r);
  const evaluated = validateEvaluation(
    {
      ...r,
      ratings: r.ratings.map((x) =>
        x.competencyId === "adaptation"
          ? { ...x, score: 1, quotes: [], sufficiency: "limited" as const }
          : x,
      ),
    },
    s,
  );
  assert.equal(evaluated.ratings[3].score, null);
  assert.equal(evaluated.ratings[3].sufficiency, "insufficient");
  assert.deepEqual(weightedScore(evaluated, s.blueprint), {
    overallScore: 4,
    coverage: 80,
    untestedCompetencies: ["adaptation"],
  });
  for (const rating of r.ratings)
    for (const quote of rating.quotes)
      assert(
        s.messages.some(
          (m) => m.role === "candidate" && m.text.includes(quote),
        ),
      );
});
test("termination is server-owned: minimum four covered turns, six turn cap, or deadline", () => {
  const s = demoRecords("test").candidates[0].session;
  s.completedAt = null;
  s.turns = 3;
  assert.equal(shouldEnd(s), false);
  s.turns = 6;
  assert.equal(shouldEnd(s), true);
  s.turns = 0;
  s.deadline = new Date(Date.now() - 1).toISOString();
  assert.equal(shouldEnd(s), true);
});

test("role-specific ranges are deterministic and known ratios are computed without model arithmetic", () => {
  const family = structuredClone(demoBlueprint.families[0]);
  family.ranges = {
    tickets: [20, 40],
    resolved: [10, 20],
    latency: [0.001, 0.005],
  };
  assert.deepEqual(
    seededNumbers("engineering", family),
    seededNumbers("engineering", family),
  );
  const facts = seededNumbers("engineering", family);
  assert(facts.tickets >= 20 && facts.tickets <= 40);
  assert(facts.resolved >= 10 && facts.resolved <= 20);
  assert(facts.latency >= 0.001 && facts.latency <= 0.005);
  assert.deepEqual(deriveScenarioMetrics({ revenue: 100, cost: 40 }), {
    revenue: 100,
    cost: 40,
    margin: 60,
  });
  assert.throws(() =>
    deriveScenarioMetrics({ revenue: 100, cost: 40, margin: 80 }),
  );
});
