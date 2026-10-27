import test from "node:test";
import assert from "node:assert/strict";
import { calculate, dataCsv } from "../../lib/b2b/calculator";

test("calculator handles precedence, parentheses, signed decimals and percentages", () => {
  assert.equal(calculate("2 + 3 * 4"), 14);
  assert.equal(calculate("(40 / 1000) * 100"), 4);
  assert.equal(calculate("2000 * 20%"), 400);
  assert.equal(calculate("-.5 * (-4 + 2)"), 1);
  assert.equal(calculate("0.1 + 0.2"), 0.3);
  assert.equal(calculate("0"), 0);
});

test("calculator rejects invalid, nonfinite and executable input", () => {
  for (const input of [
    "",
    "1/0",
    "2 +",
    "(2 + 3",
    "2 3",
    "2**3",
    "alert(1)",
    "1;fetch('x')",
    "9".repeat(301),
  ]) {
    assert.throws(() => calculate(input), Error, input);
  }
});

test("CSV quotes text and neutralizes spreadsheet formulas while preserving numeric values", () => {
  const csv = dataCsv([
    { source: 'Report, "A"', field: "=1+1", value: -5 },
    { source: "Data", field: "label", value: " @SUM(A1)" },
  ]);
  assert.ok(csv.includes('"Report, ""A"""'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"-5"'));
  assert.ok(csv.includes('"\' @SUM(A1)"'));
  assert.equal(dataCsv([]), "Source,Field,Value");
});
