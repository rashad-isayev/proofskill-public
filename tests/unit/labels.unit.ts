import test from "node:test";
import assert from "node:assert/strict";
import { humanizeKey, isInternalKey } from "../../lib/utils";

test("data keys become readable labels for candidates", () => {
  assert.equal(humanizeKey("firstResponseMinutes"), "First response minutes");
  assert.equal(humanizeKey("csatScore"), "CSAT score");
  assert.equal(humanizeKey("sla_breaches"), "SLA breaches");
  assert.equal(humanizeKey("spend"), "Spend");
});

test("internal finding keys are recognised", () => {
  assert.ok(isInternalKey("investigation_2"));
  assert.ok(isInternalKey("event_1"));
  assert.ok(!isInternalKey("openBacklog"));
});
