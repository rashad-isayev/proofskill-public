import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { candidate } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/invites/tools/monitoring", (r) =>
    r.fulfill({
      json: {
        policy: {
          version: 1,
          enabled: false,
          restrictClipboard: false,
          notice: "Legacy tool test policy.",
        },
        state: { fullscreenWarnings: 0, disqualified: false },
      },
    }),
  );
  const session = candidate();
  session.documents.push({
    id: "tool-0",
    title: "Analytics dashboard",
    content: "Available workplace tool",
  });
  session.revealedInfo = [
    {
      id: "reveal1",
      title: "Funnel update",
      data: { mobile_rate: "1.2%" },
      revealedAt: new Date().toISOString(),
    },
  ];
  await page.route("**/api/invites/tools", (r) =>
    r.fulfill({
      json: {
        roleTitle: session.roleTitle,
        durationMinutes: 15,
        demo: true,
        status: "in-progress",
        sessionId: session.id,
      },
    }),
  );
  await page.route("**/api/simulations/s1", (r) =>
    r.fulfill({ json: { session } }),
  );
  await page.route("**/api/simulations/draft", (r) =>
    r.fulfill({ json: { saved: true } }),
  );
});

test("resources open with shared dialogs, filtering and real CSV export; response survives", async ({
  page,
}, info) => {
  await page.goto("/invite/tools");
  await page
    .getByLabel("Your response", { exact: true })
    .fill("Keep my investigation plan.");
  const trigger = page.getByRole("button", {
    name: "Open Campaign brief",
    exact: true,
  });
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Reference", exact: true }).click();
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Campaign brief",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Prioritize diagnostics before expanding campaign spend.",
  );
  await page.getByLabel("Search available data").fill("mobile");
  await expect(dialog.getByRole("row")).toHaveCount(2);
  await expect(dialog).toContainText("1.2%");
  const downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("assessment-data.csv");
  const contents = await readFile((await download.path())!, "utf8");
  expect(contents).toContain('"Funnel update","mobile_rate","1.2%"');
  expect(contents).not.toContain('"spend"');
  await page.getByLabel("Search available data").fill("no such field");
  await expect(dialog).toContainText("No matching data");
  await expect(
    dialog.getByRole("button", { name: "Export CSV" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    "Keep my investigation plan.",
  );
  await page.getByRole("button", { name: "Open Analytics dashboard" }).click();
  await expect(
    page.getByRole("dialog", { name: "Analytics dashboard" }),
  ).toContainText("4 of 4 fields");
  await expect(page.getByRole("dialog")).not.toContainText(
    "Available workplace tool",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({
    path: info.outputPath("tools-dark.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test("calculator validates input, retains work on reopening, and follows the system theme", async ({
  page,
}, info) => {
  await page.goto("/invite/tools");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Reference", exact: true }).click();
  await page
    .getByRole("button", { name: "Open calculator", exact: true })
    .click();
  await page
    .getByLabel("Calculation", { exact: true })
    .fill("(40 / 1000) * 100");
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByLabel("Calculation result")).toHaveText("4");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open calculator", exact: true })
    .click();
  await expect(page.getByLabel("Calculation", { exact: true })).toHaveValue(
    "(40 / 1000) * 100",
  );
  await expect(page.getByLabel("Calculation result")).toHaveText("4");
  await page.getByLabel("Calculation", { exact: true }).fill("1/0");
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Cannot divide by zero",
  );
  await page.getByLabel("Calculation", { exact: true }).fill("2000 * 20%");
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByLabel("Calculation result")).toHaveText("400");
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({
    path: info.outputPath("calculator-light.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
