import { test } from "node:test";
import assert from "node:assert/strict";
import { demoRecords } from "../fixtures/hiring-data";
import { validateTurn } from "../../lib/hiring/validation";
test("manager numeric validation accepts stored grouped thousands and rejects fabricated grouped values", () => {
  const s = demoRecords("numeric-test").candidates[0].session;
  s.world.facts = { visitors: 17830, spend: 14264, cac: 11.33 };
  const result = {
    reply: "Compare 17,830 visitors, spend of 14,264 and CAC of 11.33.",
    evidence: [],
    nextObjective: s.blueprint.competencies[0].id,
    shouldEnd: false,
  };
  assert.equal(validateTurn(result, s), result);
  assert.throws(() =>
    validateTurn({ ...result, reply: "There are 17,831 visitors." }, s),
  );
  s.messages.push({
    id: "numeric-candidate",
    role: "candidate",
    text: "I propose a budget of 25,000.",
    turn: 1,
    createdAt: new Date().toISOString(),
  });
  assert.equal(
    validateTurn(
      { ...result, reply: "What supports your proposed 25,000 budget?" },
      s,
    ).reply,
    "What supports your proposed 25,000 budget?",
  );
});
