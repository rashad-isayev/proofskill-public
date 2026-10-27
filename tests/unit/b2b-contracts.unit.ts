import assert from "node:assert/strict";
import test from "node:test";
import {
  blueprintSchema,
  reportSchema,
  candidateViewSchema,
} from "../../lib/contracts";
import { blueprint, report, candidate } from "../b2b/fixtures";
test("blueprints require normalized weights, unique competencies, and comparable families", () => {
  assert.equal(blueprintSchema.safeParse(blueprint).success, true);
  for (const mutate of [
    (b: typeof blueprint) => {
      b.competencies[0].weight = 0.5;
    },
    (b: typeof blueprint) => {
      b.competencies[1].id = b.competencies[0].id;
    },
    (b: typeof blueprint) => {
      b.scenarioFamilies[1].difficulty.hiddenFactCount = 3;
    },
  ]) {
    const b = structuredClone(blueprint);
    mutate(b);
    assert.equal(blueprintSchema.safeParse(b).success, false);
  }
});
test("reports require real candidate quotes and the exact locked competency set", () => {
  assert.equal(reportSchema.safeParse(report).success, true);
  const invented = structuredClone(report);
  invented.competencies[0].evidence[0].quote = "Invented statement";
  assert.equal(reportSchema.safeParse(invented).success, false);
  const extra = structuredClone(report);
  extra.competencies.push({ ...extra.competencies[3], competencyId: "extra" });
  assert.equal(reportSchema.safeParse(extra).success, false);
  const manager = structuredClone(report);
  manager.competencies[0].evidence[0].messageId = "m0";
  assert.equal(reportSchema.safeParse(manager).success, false);
});
test("missing evidence is null, and excluded weight reduces coverage without depressing score", () => {
  const wrong = structuredClone(report);
  wrong.overallWeightedScore = 2.75;
  assert.equal(reportSchema.safeParse(wrong).success, false);
  const zero = structuredClone(report);
  zero.competencies[3].score = 0;
  assert.equal(reportSchema.safeParse(zero).success, false);
  const empty = structuredClone(report);
  empty.competencies = empty.competencies.map((c) => ({
    ...c,
    score: null,
    sufficiency: "insufficient",
    evidence: [],
  }));
  empty.overallWeightedScore = null;
  empty.coveragePercent = 0;
  assert.equal(reportSchema.safeParse(empty).success, true);
});
test("candidate boundary rejects hidden server fields instead of silently stripping them", () => {
  assert.equal(candidateViewSchema.safeParse(candidate()).success, true);
  for (const field of [
    "hiddenFacts",
    "nextObjective",
    "evidence",
    "blueprint",
    "report",
  ]) {
    assert.equal(
      candidateViewSchema.safeParse({
        ...candidate(),
        [field]: { secret: "never expose" },
      }).success,
      false,
    );
  }
  const nested = candidate();
  Object.assign(nested.messages[0], { nextObjective: "secret" });
  assert.equal(candidateViewSchema.safeParse(nested).success, false);
});
