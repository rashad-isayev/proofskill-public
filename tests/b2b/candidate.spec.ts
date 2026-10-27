import { test, expect } from "@playwright/test";
import { candidate, blueprint } from "./fixtures";

// Fixture-only acknowledgment; real draft persistence is covered by hiring-browser.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/simulations/draft", (r) =>
    r.fulfill({ json: { saved: true } }),
  );
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/invites/*/monitoring", (r) =>
    r.fulfill({
      json: {
        policy: {
          version: 1,
          enabled: false,
          restrictClipboard: false,
          notice: "Unmonitored fixture.",
        },
        state: { fullscreenWarnings: 0, disqualified: false },
      },
    }),
  );
});
test("candidate starts, receives updates, restores state, and completes without scores", async ({
  page,
}, info) => {
  let state = candidate();
  let started = false;
  let completed = false;
  let starts = 0;
  let replies = 0;
  await page.route("**/api/invites/private-token", (route) =>
    route.fulfill({
      json: {
        roleTitle: blueprint.roleTitle,
        durationMinutes: 15,
        demo: true,
        status: completed ? "completed" : started ? "in-progress" : "invited",
        sessionId: started ? "s1" : null,
      },
    }),
  );
  await page.route("**/api/simulations/start", (route) => {
    starts++;
    started = true;
    return route.fulfill({ json: { session: state } });
  });
  await page.route("**/api/simulations/s1", (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer private-token",
    );
    return route.fulfill({ json: { session: state } });
  });
  await page.route("**/api/simulations/respond", async (route) => {
    replies++;
    const body = route.request().postDataJSON();
    expect(body.requestId).toBeTruthy();
    expect(route.request().headers().authorization).toBe(
      "Bearer private-token",
    );
    state = {
      ...state,
      turnsCompleted: 1,
      status: "ready-to-complete",
      messages: [
        ...state.messages,
        {
          id: "answer1",
          role: "candidate",
          content: body.message,
          createdAt: new Date().toISOString(),
          turn: 1,
        },
        {
          id: "manager2",
          role: "manager",
          content: "What would you check after segmenting by device?",
          createdAt: new Date().toISOString(),
          turn: 1,
        },
      ],
      revealedInfo: [
        {
          id: "reveal1",
          title: "Mobile funnel update",
          data: { mobile_conversion_rate: "1.2%" },
          revealedAt: new Date().toISOString(),
        },
      ],
      events: [
        {
          id: "e1",
          title: "Analytics team shared a funnel update.",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await new Promise((r) => setTimeout(r, 200));
    await route.fulfill({ json: { session: state } });
  });
  await page.route("**/api/simulations/complete", (route) => {
    completed = true;
    return route.fulfill({ json: { status: "completed" } });
  });
  await page.goto("/invite/private-token");
  await expect(
    page.getByRole("heading", { name: blueprint.roleTitle }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start assessment" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Start assessment" }).click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Company", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: state.companyName }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Conversation", exact: true })
      .click();
  await expect(page.getByRole("timer")).toContainText(/14:|15:/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("candidate-workplace.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Your response", { exact: true })
    .fill("I would segment by device, then inspect tracking changes.");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Reference", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mobile funnel update" }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Conversation", exact: true })
      .click();
  await page.reload();
  await expect(
    page.getByText(
      "I would segment by device, then inspect tracking changes.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(starts).toBe(1);
  expect(replies).toBe(1);
  await page.getByRole("button", { name: "Finish assessment" }).click();
  await expect(page.locator("#main-content")).toBeEmpty();
  await page.reload();
  await expect(page.locator("#main-content")).toBeEmpty();
  await expect(
    page.getByText(/Weighted score|Evidence coverage|Overall score/),
  ).toHaveCount(0);
});

test("a failed response retains text and retries the same idempotency key", async ({
  page,
}) => {
  let state = candidate();
  const keys: string[] = [];
  await page.route("**/api/invites/retry-token", (r) =>
    r.fulfill({
      json: {
        roleTitle: state.roleTitle,
        durationMinutes: 15,
        demo: true,
        status: "in-progress",
        sessionId: "s1",
      },
    }),
  );
  await page.route("**/api/simulations/s1", (r) =>
    r.fulfill({ json: { session: state } }),
  );
  await page.route("**/api/simulations/respond", (r) => {
    const body = r.request().postDataJSON();
    keys.push(body.requestId);
    if (keys.length === 1)
      return r.fulfill({
        status: 503,
        json: { error: { message: "AI service unavailable. Please retry." } },
      });
    state = {
      ...state,
      turnsCompleted: 1,
      messages: [
        ...state.messages,
        {
          id: "a1",
          role: "candidate",
          content: body.message,
          createdAt: new Date().toISOString(),
          turn: 1,
        },
      ],
    };
    return r.fulfill({ json: { session: state } });
  });
  await page.goto("/invite/retry-token");
  await page
    .getByLabel("Your response", { exact: true })
    .fill("Preserve this diagnostic plan.");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(
    page
      .locator("[role=alert]")
      .filter({ hasText: /unavailable|invalid|expired/ }),
  ).toContainText("AI service unavailable");
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    "Preserve this diagnostic plan.",
  );
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByText("Preserve this diagnostic plan.", { exact: true }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("invalid invitation is explicit and cannot start", async ({ page }) => {
  await page.route("**/api/invites/invalid", (r) =>
    r.fulfill({
      status: 404,
      json: {
        error: { message: "This invitation is invalid or has expired." },
      },
    }),
  );
  await page.goto("/invite/invalid");
  await expect(
    page
      .locator("[role=alert]")
      .filter({ hasText: /unavailable|invalid|expired/ }),
  ).toContainText("invalid or has expired");
  await expect(
    page.getByRole("button", { name: "Start assessment" }),
  ).toHaveCount(0);
});

test("expired server deadline archives the route without session content", async ({
  page,
}) => {
  const state = {
    ...candidate(),
    deadlineAt: new Date(Date.now() - 10000).toISOString(),
  };
  await page.route("**/api/invites/expired-time", (r) =>
    r.fulfill({
      json: {
        roleTitle: state.roleTitle,
        durationMinutes: 15,
        demo: true,
        status: "in-progress",
        sessionId: "s1",
      },
    }),
  );
  await page.route("**/api/simulations/s1", (r) =>
    r.fulfill({ json: { session: state } }),
  );
  await page.goto("/invite/expired-time");
  await expect(page.locator("#main-content")).toBeEmpty();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("candidate rejects a payload containing hidden fields", async ({
  page,
}) => {
  const state = candidate();
  await page.route("**/api/invites/leak", (r) =>
    r.fulfill({
      json: {
        roleTitle: state.roleTitle,
        durationMinutes: 15,
        demo: true,
        status: "in-progress",
        sessionId: "s1",
      },
    }),
  );
  await page.route("**/api/simulations/s1", (r) =>
    r.fulfill({
      json: {
        session: {
          ...state,
          hiddenFacts: { secret: "SECRET MUST NOT RENDER" },
        },
      },
    }),
  );
  await page.goto("/invite/leak");
  await expect(
    page
      .locator("[role=alert]")
      .filter({ hasText: /unavailable|invalid|expired/ }),
  ).toContainText("invalid data");
  await expect(page.getByText("SECRET MUST NOT RENDER")).toHaveCount(0);
  await expect(page.getByLabel("Your response", { exact: true })).toHaveCount(
    0,
  );
});

test("public navigation describes the revised product and HR routes remain protected", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Don’t interview candidates.",
  );
  await page.goto("/for-job-seekers");
  await expect(
    page.getByText(
      "To begin, open the private invitation link sent by your hiring team.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Create AI Assessment/ }),
  ).toHaveCount(0);
  await page.goto("/enterprise/assessments");
  await expect(page).toHaveURL(/\/auth\/sign-in\?/);
  await expect(
    page.getByRole("button", { name: "Job seeker", exact: true }),
  ).toHaveCount(0);
  const response = await page.request.get("/api/reports/r1");
  expect(response.status()).toBe(401);
});
