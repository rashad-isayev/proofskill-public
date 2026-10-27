import { test, expect } from "@playwright/test";
import { candidate, secondCandidate } from "./candidate-fixtures";
const host = "http://127.0.0.1:3200";
const invitation = {
  ...candidate.assignments[0],
  id: "44444444-4444-4444-8444-444444444444",
  title: "Campaign planning",
  progress: "invited" as const,
  reportId: null,
  invitePath: "/invite/fictional-link",
  startedAt: null,
  completedAt: null,
};

test("candidate details organize assignments and recover from unavailable clipboard", async ({
  page,
}, info) => {
  const record = {
    ...candidate,
    assignments: [invitation, ...candidate.assignments],
  };
  await page.route("**/api/candidates", (r) =>
    r.fulfill({ json: { candidates: [record] } }),
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Unavailable");
        },
      },
    }),
  );
  await page.goto(host + "/enterprise/candidates");
  const trigger = page.getByRole("button", {
    name: "View candidate",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: candidate.name });
  await expect(
    dialog.getByText("2 assigned · 1 completed · 1 report available"),
  ).toBeVisible();
  await expect(dialog.getByLabel("Candidate hiring status")).toHaveValue(
    "pending-review",
  );
  await expect(
    dialog.getByLabel("Invitation link for Campaign planning"),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Copy invite link", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Select and copy");
  const input = dialog.getByLabel("Invitation link for Campaign planning");
  await expect(input).toHaveValue(host + "/invite/fictional-link");
  await input.focus();
  expect(
    await input.evaluate(
      (el: HTMLInputElement) => el.selectionEnd! - el.selectionStart!,
    ),
  ).toBe((await input.inputValue()).length);
  await expect(
    dialog.getByRole("link", { name: "View report" }),
  ).toHaveAttribute("href", "/enterprise/reports/r1");
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("candidate-details.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("candidate hiring status saves once and empty assignments lead to assignment", async ({
  page,
}) => {
  let record = { ...secondCandidate };
  let writes = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/candidates", (r) =>
    r.fulfill({ json: { candidates: [record] } }),
  );
  await page.route("**/api/candidates/" + record.id, async (r) => {
    writes++;
    const body = r.request().postDataJSON();
    await barrier;
    record = {
      ...record,
      decision: body.decision,
      revision: record.revision + 1,
    };
    await r.fulfill({ json: { saved: true } });
  });
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [] } }),
  );
  await page.goto(host + "/enterprise/candidates");
  await page
    .getByRole("button", { name: "View candidate", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: record.name });
  await expect(dialog.getByText("No assessments assigned yet")).toBeVisible();
  await dialog.getByLabel("Candidate hiring status").selectOption("selected");
  await expect(
    dialog.getByRole("button", { name: "Assign assessment" }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("Candidate hiring status")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(dialog.getByLabel("Candidate hiring status")).toHaveValue(
    "selected",
  );
  await expect(dialog.getByText(/Hiring status updated/)).toBeVisible();
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Assign assessment" }).click();
  await expect(
    page.getByRole("dialog", { name: "Assign assessment" }),
  ).toBeVisible();
});
