import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV,
  toSheet,
  previewImport,
  suggestedMapping,
} from "../../lib/candidates/import";
import {
  candidateInputSchema,
  assignInputSchema,
} from "../../lib/candidates/contracts";

test("CSV supports escaped quotes, BOM, CRLF and multiline cells; rejects malformed files", () => {
  const rows = parseCSV(
    '\uFEFFName,Email,Position\r\n"Alex, A.",ALEX@example.test,"Analyst\nMarketing"\r\n"Sam ""S""",sam@example.test,\r\n',
  );
  assert.deepEqual(rows[1], [
    "Alex, A.",
    "ALEX@example.test",
    "Analyst\nMarketing",
  ]);
  assert.equal(rows[2][0], 'Sam "S"');
  assert.throws(() => parseCSV('name,email\n"unfinished'));
  assert.throws(() => parseCSV('name,email\n"closed"wrong,a@example.test'));
  assert.throws(
    () => parseCSV(Array(52).fill("column").join(",")),
    /at most 50 columns/,
  );
  assert.throws(() =>
    toSheet(
      "too many",
      Array.from({ length: 502 }, () => ["n", "e"]),
    ),
  );
});
test("mapped import validates email/name, normalizes and skips directory and file duplicates", () => {
  const sheet = toSheet("candidates", [
    ["Contact", "Person", "Opening"],
    [" SAM@example.test ", "Sam", "Analyst"],
    ["bad-email", "Invalid", ""],
    ["sam@example.test", "Repeat", ""],
    ["existing@example.test", "Existing", ""],
    ["new@example.test", "", ""],
    ["new@example.test", "New", ""],
  ]);
  const preview = previewImport(sheet, { name: 1, email: 0, position: 2 }, [
    "EXISTING@example.test",
  ]);
  assert.deepEqual(
    preview.map((r) => r.status),
    ["ready", "invalid", "duplicate", "duplicate", "invalid", "ready"],
  );
  assert.equal(preview[0].input.email, "sam@example.test");
  assert.equal(preview[0].input.position, "Analyst");
  assert.deepEqual(suggestedMapping(["Name", "Email", "Role"]), {
    name: 0,
    email: 1,
    position: 2,
  });
  assert.equal(
    candidateInputSchema.parse({
      name: " A ",
      email: " A@example.test ",
      position: "",
    }).email,
    "a@example.test",
  );
  assert.equal(
    assignInputSchema.safeParse({
      candidateIds: [],
      assessmentId: crypto.randomUUID(),
      assessmentVersion: 1,
      requestId: crypto.randomUUID(),
    }).success,
    false,
  );
});
