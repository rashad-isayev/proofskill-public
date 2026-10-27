import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountWorkspaceSchema,
  emptyAccountWorkspace,
  profileSchema,
} from "../../lib/account/contracts";
import { sampleRecord } from "../../components/reports/sample-records";
import { workspaceWalkthrough } from "../../lib/labs/catalog";
import { createAttempt } from "../../lib/labs/contracts";
import {
  jobSchema,
  applicationSchema,
  applicationStatusSchema,
} from "../../lib/jobs/contracts";
import { routeExperience, safeDestination } from "../../lib/auth/experience";

test("account import rejects fabricated evidence and verified-source claims", () => {
  const sample = structuredClone(sampleRecord);
  assert.ok(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      records: [sample],
    }).success,
  );
  sample.report.skills[0].evidence[0].quote =
    "This candidate never wrote this quote.";
  assert.equal(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      records: [sample],
    }).success,
    false,
  );
  assert.equal(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      records: [{ ...sampleRecord, source: "assessment" }],
    }).success,
    false,
  );
});
test("account evidence bounds IDs, duplicates, review references and submitted lab completeness", () => {
  const attempt = createAttempt(workspaceWalkthrough);
  assert.ok(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      attempts: [attempt],
    }).success,
  );
  assert.equal(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      attempts: [attempt, attempt],
    }).success,
    false,
  );
  assert.equal(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      attempts: [{ ...attempt, id: "../../other-account" }],
    }).success,
    false,
  );
  assert.equal(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      attempts: [
        {
          ...attempt,
          status: "submitted",
          submittedAt: new Date().toISOString(),
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    accountWorkspaceSchema.safeParse({
      ...emptyAccountWorkspace,
      reviews: { unknown: { status: "reviewed", note: "test" } },
    }).success,
    false,
  );
});
test("profile and application boundaries require explicit sharing and bounded fields", () => {
  assert.equal(
    profileSchema.safeParse({
      displayName: "",
      headline: "",
      career: "undecided",
      about: "",
    }).success,
    false,
  );
  assert.equal(
    applicationSchema.safeParse({
      note: "A useful note about relevant work and practical experience.",
      reportId: null,
      consent: false,
    }).success,
    false,
  );
  assert.ok(
    applicationSchema.safeParse({
      note: "A useful note about relevant work and practical experience.",
      reportId: null,
      consent: true,
    }).success,
  );
  assert.equal(
    jobSchema.safeParse({
      title: "Engineer",
      team: "Test",
      location: "Remote",
      description: "Too short",
    }).success,
    false,
  );
  assert.equal(applicationStatusSchema.safeParse("auto-hired").success, false);
});
test("new routes preserve experience restrictions and safe return destinations", () => {
  assert.equal(routeExperience("/jobs/abc"), null);
  assert.equal(routeExperience("/enterprise/jobs/abc"), "enterprise");
  assert.equal(routeExperience("/profile"), null);
  assert.equal(safeDestination("/api/jobs", "job-seeker"), "/enterprise");
  assert.equal(
    safeDestination("/enterprise/jobs", "job-seeker"),
    "/enterprise",
  );
  assert.equal(
    safeDestination("//example.com/jobs", "job-seeker"),
    "/enterprise",
  );
});
