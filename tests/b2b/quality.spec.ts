import { test, expect } from "@playwright/test";
import { assessment, invite, report } from "./fixtures";
import { candidate } from "./candidate-fixtures";
const host = "http://127.0.0.1:3200";

test("catalog distinguishes filters from empty data and hides old cards on failed refresh", async ({
  page,
}) => {
  let fail = false;
  await page.route("**/api/assessments", (r) =>
    fail
      ? r.fulfill({
          status: 503,
          json: { error: { message: "Catalog unavailable." } },
        })
      : r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.goto(host + "/enterprise/assessments");
  await expect(
    page.getByRole("link", { name: "Open assessment", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search hiring records").fill("no matching position");
  await expect(
    page.getByRole("heading", { name: "No matching assessments." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("1 assessment", { exact: true })).toBeVisible();
  fail = true;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Catalog unavailable.");
  await expect(
    page.getByRole("link", { name: "Open assessment", exact: true }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open assessment", exact: true }),
  ).toBeVisible();
});

test("comparison invalidates evidence and excludes the other selected candidate", async ({
  page,
}) => {
  const second = {
    ...invite,
    id: "i2",
    candidateName: "Another candidate",
    reportId: "r2",
  };
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [invite, second] } }),
  );
  await page.route("**/api/reports/*", (r) =>
    r.fulfill({
      json: {
        report: {
          ...report,
          id: r.request().url().endsWith("r2") ? "r2" : "r1",
        },
      },
    }),
  );
  await page.goto(host + "/enterprise/compare");
  await expect(page.getByLabel("Candidate 1")).toBeDisabled();
  await page.getByLabel("Assessment version").selectOption("a1");
  await page.getByLabel("Candidate 1").selectOption("r1");
  await expect(
    page.getByLabel("Candidate 2").locator('option[value="r1"]'),
  ).toHaveAttribute("disabled", "");
  await page.getByLabel("Candidate 2").selectOption("r2");
  await page.getByRole("button", { name: "Compare evidence" }).click();
  const comparison = page.getByRole("region", {
    name: "Side by side candidate comparison",
  });
  await expect(comparison).toBeVisible();
  await page.getByLabel("Candidate 2").selectOption("");
  await expect(comparison).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compare evidence" }),
  ).toBeDisabled();
});

test("comparison explains why one report is insufficient", async ({ page }) => {
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [invite] } }),
  );
  await page.goto(host + "/enterprise/compare");
  await page.getByLabel("Assessment version").selectOption("a1");
  await expect(
    page.getByText(
      "Two completed reports on this version are needed for comparison.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Candidate 1")).toBeDisabled();
});

test("human review freezes the submitted draft and clears success after new edits", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/reports/r1", async (r) => {
    if (r.request().method() === "PATCH") {
      await ready;
      return r.fulfill({
        json: { report: { ...report, ...r.request().postDataJSON() } },
      });
    }
    return r.fulfill({ json: { report } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(host + "/enterprise/reports/r1");
  await page
    .getByRole("button", { name: /Inspect original response/ })
    .first()
    .click();
  await expect(page.locator("li:focus mark")).toBeVisible();
  await page.getByLabel("Private reviewer notes").fill("Submitted notes.");
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByLabel("Private reviewer notes")).toBeDisabled();
  await expect(page.getByLabel("Human decision")).toBeDisabled();
  release();
  await expect(page.getByRole("status")).toHaveText("Human review saved.");
  await page.getByLabel("Private reviewer notes").fill("New unsaved notes.");
  await expect(page.getByText("Human review saved.")).toHaveCount(0);
});

test("latest directory refresh wins when an earlier read finishes later", async ({
  page,
}) => {
  let reads = 0;
  let release!: () => void;
  let finished!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const completed = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route("**/api/candidates", async (r) => {
    const current = ++reads;
    if (current === 2) await delayed;
    await r.fulfill({
      json: {
        candidates: [
          {
            ...candidate,
            name: current === 2 ? "Outdated name" : "Current name",
          },
        ],
      },
    });
    if (current === 2) finished();
  });
  await page.goto(host + "/enterprise/candidates");
  await expect(
    page.getByRole("button", { name: "Current name", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh candidates" }).click();
  await expect.poll(() => reads).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => reads).toBe(3);
  await expect(
    page.getByRole("button", { name: "Refresh candidates" }),
  ).toBeEnabled();
  release();
  await completed;
  // Wait for both browser fetches to settle and React to paint the final state.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(
    page.getByRole("button", { name: "Current name", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Outdated name", exact: true }),
  ).toHaveCount(0);
});

test("assignment can retry failed assessment reads without losing selection", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/candidates", (r) =>
    r.fulfill({ json: { candidates: [candidate] } }),
  );
  await page.route("**/api/assessments", (r) =>
    ++reads === 1
      ? r.fulfill({
          status: 503,
          json: { error: { message: "Assessment list unavailable." } },
        })
      : r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.goto(host + "/enterprise/candidates");
  await page.getByLabel(`Select ${candidate.name}`, { exact: true }).check();
  await page.getByRole("button", { name: "Assign assessment (1)" }).click();
  const dialog = page.getByRole("dialog", { name: "Assign assessment" });
  await expect(dialog.getByRole("alert")).toContainText(
    "Assessment list unavailable.",
  );
  await dialog.getByRole("button", { name: "Retry" }).click();
  await dialog.getByLabel("Published assessment").selectOption("a1");
  await expect(
    dialog.getByRole("button", { name: "Assign and create links" }),
  ).toBeEnabled();
  await expect(dialog.getByText("1 candidate selected")).toBeVisible();
});

test("long supplied role and report text stays inside narrow viewports in both themes", async ({
  page,
}, info) => {
  const long = "LongUnbrokenCandidateSuppliedValue".repeat(4);
  await page.route("**/api/assessments", (r) =>
    r.fulfill({
      json: {
        assessments: [
          {
            ...assessment,
            blueprint: { ...assessment.blueprint, roleTitle: long },
          },
        ],
      },
    }),
  );
  await page.route("**/api/reports/r1", (r) =>
    r.fulfill({
      json: {
        report: {
          ...report,
          roleTitle: long,
          reviewerNotes: long,
          strengths: [long],
        },
      },
    }),
  );
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const path of ["/enterprise/assessments", "/enterprise/reports/r1"]) {
      await page.goto(host + path + "?shell");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (path.includes("/reports/"))
        await page.screenshot({
          path: info.outputPath("long-review-" + colorScheme + ".png"),
          fullPage: true,
        });
    }
  }
});

test("failed report saves keep the draft and allow retry", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/reports/r1", (r) => {
    if (r.request().method() === "PATCH" && ++writes === 1)
      return r.fulfill({
        status: 503,
        json: { error: { message: "Review save unavailable." } },
      });
    return r.fulfill({
      json: {
        report:
          r.request().method() === "PATCH"
            ? { ...report, ...r.request().postDataJSON() }
            : report,
      },
    });
  });
  await page.goto(host + "/enterprise/reports/r1");
  await page
    .getByLabel("Private reviewer notes")
    .fill("Keep this unsaved review.");
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Review save unavailable.",
  );
  await expect(page.getByLabel("Private reviewer notes")).toHaveValue(
    "Keep this unsaved review.",
  );
  await expect(page.getByLabel("Private reviewer notes")).toBeEnabled();
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByRole("status")).toHaveText("Human review saved.");
});

test("direct editor retries source loading and preserves edited blueprint after failed save", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/assessments/a1", (r) =>
    ++reads === 1
      ? r.fulfill({
          status: 503,
          json: { error: { message: "Version load unavailable." } },
        })
      : r.fulfill({ json: { assessment, invites: [] } }),
  );
  await page.route("**/api/assessments", (r) =>
    r.fulfill({
      status: 503,
      json: { error: { message: "Blueprint save unavailable." } },
    }),
  );
  await page.goto(host + "/enterprise/assessments/a1/edit");
  await expect(page.getByRole("alert")).toContainText(
    "Version load unavailable.",
  );
  await page.getByRole("button", { name: "Retry" }).click();
  const name = page.getByLabel("Competency 1 name", { exact: true });
  await name.fill("Retained edited competency");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Blueprint save unavailable.",
  );
  await expect(name).toHaveValue("Retained edited competency");
  await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  expect(reads).toBe(2);
});
