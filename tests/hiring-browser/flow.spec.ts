import { publicBlueprint } from "../../lib/hiring/presentation";
import { demoBlueprint } from "../fixtures/hiring-data";
import { test, expect, switchExperience } from "../fixtures/auth";

test("HR creation, invitation, durable candidate workplace, errors, private report and human review", async ({
  page,
  browser,
}, info) => {
  await switchExperience(page, "enterprise");
  await page.goto("/enterprise");
  await expect(
    page.getByRole("link", { name: "Create AI Assessment" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create AI Assessment" }).click();
  await page
    .getByLabel("Job title", { exact: true })
    .fill("Junior Digital Marketing Specialist");
  await page
    .getByLabel("Job description", { exact: true })
    .fill(
      "Investigate campaign performance and make evidence-based marketing decisions in a fictional business.",
    );
  await page.getByLabel("Seniority", { exact: true }).fill("Junior");
  await page
    .getByRole("button", { name: "Generate AI blueprint", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review the blueprint.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "Require camera, entire-screen sharing, and fullscreen",
    })
    .uncheck();
  await page.getByRole("button", { name: "Publish assessment" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/enterprise\/assessments$/);
  await page
    .getByRole("status")
    .getByRole("link", { name: "Open assessment" })
    .click();
  await expect(page).toHaveURL(/\/enterprise\/assessments\/[0-9a-f-]+$/, {
    timeout: 20000,
  });
  const assessmentId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("link", { name: "Assign candidates" }).click();
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .first()
    .click();
  const add = page.getByRole("dialog", { name: "Add candidate", exact: true });
  const candidateName =
    "Flow Candidate " + info.project.name + " " + Date.now();
  await add.getByLabel("Name", { exact: true }).fill(candidateName);
  await add
    .getByLabel("Email", { exact: true })
    .fill("flow-" + Date.now() + "@example.test");
  await add.getByRole("button", { name: "Add candidate", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select " + candidateName, exact: true })
    .check();
  await page
    .getByRole("button", { name: "Assign assessment (1)", exact: true })
    .click();
  const assign = page.getByRole("dialog", {
    name: "Assign assessment",
    exact: true,
  });
  await assign
    .getByLabel("Published assessment", { exact: true })
    .selectOption(assessmentId);
  await assign.getByRole("button", { name: "Assign and create links" }).click();
  await expect(assign).not.toBeVisible();
  await page.getByRole("button", { name: candidateName, exact: true }).click();
  const details = page.getByRole("dialog", {
    name: candidateName,
    exact: true,
  });
  await details.getByRole("button", { name: "Show link", exact: true }).click();
  const url = await details
    .getByLabel("Invitation link for Junior Digital Marketing Specialist", {
      exact: true,
    })
    .inputValue();
  await details.getByRole("button", { name: "Close dialog" }).click();
  const token = url.split("/").at(-1)!;
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport:
      info.project.name === "mobile"
        ? { width: 393, height: 851 }
        : { width: 1440, height: 1000 },
  });
  const candidate = await context.newPage();
  const payloads: string[] = [];
  candidate.on("response", async (r) => {
    if (r.url().includes("/api/simulations/")) {
      const text = await r.text().catch(() => null);
      if (text !== null) payloads.push(text);
    }
  });
  await candidate.goto(url);
  await expect(
    candidate.getByRole("button", { name: "Start assessment" }),
  ).toBeVisible();
  await candidate.getByRole("button", { name: "Start assessment" }).click();
  await expect(
    candidate.getByRole("heading", { name: "Conversation with your manager" }),
  ).toBeVisible();
  await candidate
    .getByLabel("Your response", { exact: true })
    .fill("Draft investigation persists before sending.");
  await candidate.waitForTimeout(1000);
  await candidate.reload();
  await expect(
    candidate.getByLabel("Your response", { exact: true }),
  ).toHaveValue("Draft investigation persists before sending.");
  await candidate
    .getByLabel("Your response", { exact: true })
    .fill("FORCE_FAILURE: my response must survive a provider failure.");
  await candidate.getByRole("button", { name: "Submit response" }).click();
  await expect(
    candidate
      .getByRole("alert")
      .filter({ hasText: "AI service could not complete" }),
  ).toContainText("AI service could not complete");
  await expect(
    candidate.getByLabel("Your response", { exact: true }),
  ).toHaveValue("FORCE_FAILURE: my response must survive a provider failure.");
  await expect(
    candidate.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  for (const answer of [
    "Increase the ad budget.",
    "Please investigate the tracking before acting.",
    "I will compare alternatives using the facts.",
    "I will explain the uncertainty and propose a reversible next step.",
  ]) {
    await candidate.getByLabel("Your response", { exact: true }).fill(answer);
    await candidate.getByRole("button", { name: "Submit response" }).click();
    await expect(
      candidate.getByRole("button", { name: "Sending…" }),
    ).toHaveCount(0);
  }
  await expect(
    candidate.getByRole("button", { name: "Finish assessment" }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await candidate
      .getByRole("button", { name: "Company", exact: true })
      .click();
  await expect(
    candidate.getByText("Workplace activity", { exact: true }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await candidate
      .getByRole("button", { name: "Reference", exact: true })
      .click();
  await expect(
    candidate.getByText("Revealed information", { exact: true }),
  ).toBeVisible();
  expect(
    await candidate.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await candidate.screenshot({
    path: `/tmp/proofskill-adaptive-${info.project.name}.png`,
    fullPage: true,
  });
  if (info.project.name === "mobile")
    await candidate
      .getByRole("button", { name: "Conversation", exact: true })
      .click();
  await candidate.getByRole("button", { name: "Finish assessment" }).click();
  await expect(candidate.locator("#main-content")).toBeEmpty();
  await candidate.reload();
  await expect(candidate.locator("#main-content")).toBeEmpty();
  for (const payload of payloads)
    for (const forbidden of [
      "hiddenFacts",
      "nextObjective",
      "evidence",
      "blueprint",
      "rubric",
      "ratings",
      "overallScore",
    ])
      expect(payload).not.toContain('"' + forbidden + '"');
  const hrAttempt = await candidate.request.get(
    "/api/assessments/" + assessmentId,
  );
  expect(hrAttempt.status()).toBe(401);
  await page.reload();
  await expect(
    page.getByRole("cell", { name: "Completed", exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: candidateName, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "View report", exact: true })
    .click();
  await expect(page).toHaveURL(/\/enterprise\/reports\/[0-9a-f-]+$/);
  const reportId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(
    (
      await candidate.request.get("/api/reports/" + reportId, {
        headers: { Authorization: "Bearer " + token },
      })
    ).status(),
  ).toBe(401);
  await expect(
    page.getByRole("heading", { name: "Simulation replay" }),
  ).toBeVisible();
  await page
    .getByLabel("Private reviewer notes")
    .fill("Human review completed; inspect the assumptions in follow-up.");
  await page.getByLabel("Mark reviewed", { exact: true }).check();
  await page.getByLabel("Human decision", { exact: true }).selectOption("hold");
  await page.getByRole("button", { name: "Save human review" }).click();
  await expect(
    page.getByText("Human review saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Human decision", { exact: true })).toHaveValue(
    "hold",
  );
  await context.close();
});

test("HR-only login and retired routes have no sample product", async ({
  page,
}) => {
  await page.goto("/auth?switch=1");
  await expect(
    page.getByRole("heading", { name: "Continue to your hiring workspace." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Job seeker/ })).toHaveCount(0);
  const bad = await page.request.post("/api/auth/experience", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { experience: "job-seeker" },
  });
  expect(bad.status()).toBe(400);
  for (const path of [
    "/workspace",
    "/reports/sample",
    "/labs",
    "/jobs",
    "/enterprise/legacy",
    "/enterprise/jobs",
    "/api/assessments/demo",
    "/api/jobs",
    "/api/account/workspace",
  ]) {
    expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(
      404,
    );
  }
  await page.goto("/enterprise");
  await expect(
    page.getByRole("button", { name: "Load demo records" }),
  ).toHaveCount(0);
});

test("deadline archives a real token route; HR can retry the report privately", async ({
  page,
  browser,
}) => {
  const { Pool } = await import("pg");
  const { loadEnvFile } = await import("node:process");
  if (!process.env.APP_DATABASE_URL && !process.env.AUTH_DATABASE_URL) {
    loadEnvFile(".env.local");
  }
  const pool = new Pool({
    connectionString:
      process.env.APP_DATABASE_URL || process.env.AUTH_DATABASE_URL,
  });
  const a = await (
    await page.request.post("/api/assessments", {
      headers: { Origin: "http://127.0.0.1:3100" },
      data: {
        blueprint: publicBlueprint(demoBlueprint),
        status: "published",
        requestId: crypto.randomUUID(),
      },
    })
  ).json();
  const i = await (
    await page.request.post(
      "/api/assessments/" + a.assessment.id + "/invites",
      {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: {
          candidateName: "Archive test",
          candidateEmail: "archive@example.test",
          assessmentVersion: a.assessment.version,
          requestId: crypto.randomUUID(),
        },
      },
    )
  ).json();
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const candidate = await context.newPage();
  try {
    await candidate.goto(i.url);
    await candidate.getByRole("button", { name: "Start assessment" }).click();
    await expect(
      candidate.getByLabel("Your response", { exact: true }),
    ).toBeVisible();
    const entry = await (
      await candidate.request.get("/api/invites/" + i.invite.token)
    ).json();
    // Model a naturally expired session: its start must precede its deadline.
    const deadline = Date.now() - 1000;
    await pool.query(
      "UPDATE proofskill_hiring_session SET payload=jsonb_set(jsonb_set(payload,'{deadline}',to_jsonb($2::text)),'{startedAt}',to_jsonb($3::text)) WHERE id=$1",
      [
        entry.sessionId,
        new Date(deadline).toISOString(),
        new Date(deadline - 15 * 60 * 1000).toISOString(),
      ],
    );
    await candidate.reload();
    await expect(candidate.locator("#main-content")).toBeEmpty();
    expect(
      (
        await candidate.request.get("/api/simulations/" + entry.sessionId, {
          headers: { Authorization: "Bearer " + i.invite.token },
        })
      ).status(),
    ).toBe(410);
    await page.goto("/enterprise/assessments/" + a.assessment.id);
    await expect(
      page.getByRole("cell", { name: "Archived", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Generate report", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open report", exact: true }),
    ).toBeVisible();
    expect(
      (
        await candidate.request.post("/api/simulations/evaluate", {
          headers: { Origin: "http://127.0.0.1:3100" },
          data: { sessionId: entry.sessionId },
        })
      ).status(),
    ).toBe(401);
  } finally {
    await pool.end();
    await context.close();
  }
});
