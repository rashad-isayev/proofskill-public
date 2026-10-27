// HR component integration tests use a separate test-only host, not a production auth bypass.
import { test, expect } from "@playwright/test";
import { assessment, blueprint, invite, report, date } from "./fixtures";
import { candidate, secondCandidate } from "./candidate-fixtures";
const host = "http://127.0.0.1:3200";

test("dashboard uses real API counts and renders empty data without fabricated metrics", async ({
  page,
}) => {
  await page.route("**/api/dashboard", (r) =>
    r.fulfill({
      json: {
        counts: {
          activePositions: 0,
          publishedAssessments: 0,
          invitedCandidates: 0,
          completedSimulations: 0,
          awaitingReview: 0,
        },
        activity: [],
        demo: false,
      },
    }),
  );
  await page.goto(host + "/enterprise");
  await expect(
    page.getByText("Start with the role you’re hiring for."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create AI Assessment" }),
  ).toHaveAttribute("href", "/enterprise/assessments?create=1");
  expect(await page.getByText("0", { exact: true }).count()).toBe(5);
});

test("generate, edit, reject invalid weights, and publish a locked blueprint", async ({
  page,
}) => {
  let generation = 0;
  let saves = 0;
  await page.route("**/api/assessments/generate", (r) => {
    generation++;
    if (generation === 1)
      return r.fulfill({
        status: 503,
        json: { error: { message: "Blueprint generation unavailable." } },
      });
    expect(r.request().postDataJSON().jobTitle).toBe(blueprint.roleTitle);
    expect(r.request().postDataJSON().jobDescription).toContain(
      "Workplace and industry:\nSubscription retail",
    );
    expect(r.request().postDataJSON().jobDescription).toContain(
      "Expected outcomes and evidence:\nExplain a measurable campaign decision",
    );
    return r.fulfill({ json: { blueprint } });
  });
  await page.route("**/api/assessments", (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({ json: { assessments: [] } });
    saves++;
    const body = r.request().postDataJSON();
    expect(body.status).toBe("published");
    expect(body.blueprint.competencies[0].name).toBe("Evidence reasoning");
    return r.fulfill({
      json: { assessment: { ...assessment, blueprint: body.blueprint } },
    });
  });
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [] } }),
  );
  await page.goto(host + "/enterprise/assessments?create=1");
  await page.getByLabel("Job title", { exact: true }).fill(blueprint.roleTitle);
  await page.getByLabel("Seniority", { exact: true }).fill("Junior");
  await page
    .getByLabel("Job description", { exact: true })
    .fill(blueprint.description);
  await page
    .getByLabel("Workplace and industry", { exact: false })
    .fill("Subscription retail");
  await page
    .getByLabel("Expected outcomes and evidence", { exact: false })
    .fill("Explain a measurable campaign decision");
  await page.getByRole("button", { name: /Generate/ }).click();
  await expect(page.getByRole("alert")).toContainText("generation unavailable");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "Review the blueprint." }),
  ).toBeVisible();
  await page
    .getByLabel("Competency 1 name", { exact: true })
    .first()
    .fill("Evidence reasoning");
  const weights = page.getByLabel(/weight \(%%?\)/i);
  await weights.first().fill("50");
  await page.getByRole("button", { name: /Publish/ }).click();
  await expect(page.getByRole("alert")).toContainText("sum to 100%");
  expect(saves).toBe(0);
  await weights.first().fill("25");
  await page.getByRole("button", { name: /Publish/ }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(host + "/enterprise/assessments");
  await expect(page.getByRole("status")).toContainText("Assessment published.");
  expect(generation).toBe(2);
  expect(saves).toBe(1);
});

test("published edit carries the base version and invitations produce candidate links", async ({
  page,
}) => {
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [invite] } }),
  );
  await page.route("**/api/assessments/a1/invites", (r) => {
    expect(r.request().postDataJSON().assessmentVersion).toBe(1);
    return r.fulfill({ json: { invite } });
  });
  await page.goto(host + "/enterprise/assessments/a1");
  await expect(
    page.getByRole("link", { name: "Create new version" }),
  ).toHaveAttribute("href", "/enterprise/assessments?create=1&from=a1");
  await expect(
    page.getByRole("link", { name: "Assign candidates" }),
  ).toHaveAttribute("href", "/enterprise/candidates?assessment=a1");
  await page.route("**/api/assessments", (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({ json: { assessments: [] } });
    expect(r.request().postDataJSON()).toMatchObject({
      assessmentId: "a1",
      baseVersion: 1,
      status: "draft",
    });
    return r.fulfill({
      json: {
        assessment: {
          ...assessment,
          version: 2,
          status: "draft",
          publishedAt: null,
        },
      },
    });
  });
  await page.goto(host + "/enterprise/assessments?create=1&from=a1");
  await expect(
    page.getByRole("heading", { name: "Review the blueprint." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Assessment saved as draft.",
  );
});

test("report keeps missing evidence as gaps, links quotes to replay, and saves human review", async ({
  page,
}) => {
  let persisted = structuredClone(report);
  await page.route("**/api/reports/r1", (r) => {
    if (r.request().method() === "PATCH") {
      const body = r.request().postDataJSON();
      expect(body).toMatchObject({
        reviewerNotes: "Discuss assumptions with the candidate.",
        reviewed: true,
        humanDecision: "hold",
      });
      persisted = { ...persisted, ...body };
    }
    return r.fulfill({ json: { report: persisted } });
  });
  await page.goto(host + "/enterprise/reports/r1");
  await expect(page.getByText("Evidence coverage: 75%")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Missing evidence/ }),
  ).toBeVisible();
  expect(await page.locator("svg circle").count()).toBe(3);
  await page
    .getByRole("button", { name: /Inspect original response/ })
    .first()
    .click();
  await expect(page.locator("mark")).toHaveText(
    "I would compare conversion rates by device.",
  );
  await page
    .getByLabel("Private reviewer notes")
    .fill("Discuss assumptions with the candidate.");
  await page.getByLabel("Mark reviewed").check();
  await page.getByLabel("Human decision").selectOption("hold");
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(page.getByRole("status")).toHaveText("Human review saved.");
  await page.reload();
  await expect(page.getByLabel("Private reviewer notes")).toHaveValue(
    "Discuss assumptions with the candidate.",
  );
  await expect(page.getByLabel("Mark reviewed")).toBeChecked();
});

test("candidate filters and comparisons keep compatible versions without ranking", async ({
  page,
}) => {
  const second = {
    ...invite,
    id: "i2",
    candidateName: "Demo Sam",
    candidateEmail: "sam@example.test",
    reportId: "r2",
  };
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [invite, second] } }),
  );
  await page.route("**/api/reports/r1", (r) => r.fulfill({ json: { report } }));
  await page.route("**/api/reports/r2", (r) =>
    r.fulfill({
      json: {
        report: {
          ...report,
          id: "r2",
          candidateName: "Demo Sam",
          createdAt: date,
        },
      },
    }),
  );
  await page.route("**/api/candidates", (r) =>
    r.fulfill({ json: { candidates: [candidate, secondCandidate] } }),
  );
  await page.goto(host + "/enterprise/candidates");
  await expect(
    page.getByRole("button", { name: "Demo Sam", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox").fill("Alex");
  await expect(
    page.getByRole("button", { name: "Demo Sam", exact: true }),
  ).toHaveCount(0);
  await page.goto(host + "/enterprise/compare");
  await page.getByLabel("Assessment version").selectOption("a1");
  await page.getByLabel("Candidate 1").selectOption("r1");
  await page.getByLabel("Candidate 2").selectOption("r2");
  await page.getByRole("button", { name: "Compare evidence" }).click();
  await expect(
    page.getByRole("region", { name: "Side by side candidate comparison" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Demo Alex/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Demo Sam/ })).toBeVisible();
  await expect(page.getByText(/Hire recommendation|Rank #/)).toHaveCount(0);
});

test("comparison rejects reports from different locked versions", async ({
  page,
}) => {
  const second = {
    ...invite,
    id: "i2",
    candidateName: "Demo Sam",
    reportId: "r2",
  };
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [invite, second] } }),
  );
  await page.route("**/api/reports/r1", (r) => r.fulfill({ json: { report } }));
  await page.route("**/api/reports/r2", (r) =>
    r.fulfill({
      json: { report: { ...report, id: "r2", assessmentVersion: 2 } },
    }),
  );
  await page.goto(host + "/enterprise/compare");
  await page.getByLabel("Assessment version").selectOption("a1");
  await page.getByLabel("Candidate 1").selectOption("r1");
  await page.getByLabel("Candidate 2").selectOption("r2");
  await page.getByRole("button", { name: "Compare evidence" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "same assessment and locked version",
  );
  await expect(
    page.getByRole("region", { name: "Side by side candidate comparison" }),
  ).toHaveCount(0);
});

test("review is usable by keyboard and fits its viewport", async ({
  page,
}, info) => {
  await page.route("**/api/reports/r1", (r) => r.fulfill({ json: { report } }));
  await page.goto(host + "/enterprise/reports/r1");
  await expect(page.getByRole("heading", { name: /Demo Alex/ })).toBeVisible();
  await page.getByLabel("Private reviewer notes").focus();
  await page.keyboard.type("Keyboard review.");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Mark reviewed")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("report.png"),
    fullPage: true,
  });
});

test("assessment creation dialog retains inputs and filters, traps focus, and fits the viewport", async ({
  page,
}, info) => {
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [] } }),
  );
  await page.goto(host + "/enterprise/assessments");
  await page.getByLabel("Search hiring records").fill("Marketing");
  const trigger = page.getByRole("button", {
    name: "Create AI Assessment",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Create assessment",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(host + "/enterprise/assessments");
  await dialog
    .getByLabel("Job title", { exact: true })
    .fill("Marketing Analyst");
  await dialog
    .getByLabel("Workplace and industry", { exact: false })
    .fill("Subscription retail");
  await dialog.getByRole("button", { name: "Close assessment dialog" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Search hiring records")).toHaveValue(
    "Marketing",
  );
  await trigger.click();
  await expect(dialog.getByLabel("Job title", { exact: true })).toHaveValue(
    "Marketing Analyst",
  );
  await expect(
    dialog.getByLabel("Workplace and industry", { exact: false }),
  ).toHaveValue("Subscription retail");
  await dialog.getByLabel("Job title", { exact: true }).focus();
  await page.screenshot({
    path: info.outputPath("creation-dialog.png"),
    fullPage: true,
  });
});

test("generation keeps the dialog open while pending and lets HR revise the original context", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [] } }),
  );
  await page.route("**/api/assessments/generate", async (r) => {
    await ready;
    await r.fulfill({ json: { blueprint } });
  });
  await page.goto(host + "/enterprise/assessments");
  await page
    .getByRole("button", { name: "Create AI Assessment", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Job title", { exact: true })
    .fill(blueprint.roleTitle);
  await dialog.getByLabel("Seniority", { exact: true }).fill("Junior");
  await dialog
    .getByLabel("Job description", { exact: true })
    .fill(blueprint.description);
  await dialog
    .getByLabel("Typical tasks and decisions", { exact: false })
    .fill("Prioritize a campaign investigation");
  await dialog.getByRole("button", { name: "Generate AI blueprint" }).click();
  await expect(
    dialog.getByRole("button", { name: "Close assessment dialog" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(
    dialog.getByRole("heading", { name: "Review the blueprint." }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Edit role details" }).click();
  await expect(dialog.getByLabel("Job title", { exact: true })).toHaveValue(
    blueprint.roleTitle,
  );
  await expect(
    dialog.getByLabel("Typical tasks and decisions", { exact: false }),
  ).toHaveValue("Prioritize a campaign investigation");
});
