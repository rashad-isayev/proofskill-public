import ExcelJS from "exceljs";
import { test, expect } from "../fixtures/auth";
import { publicBlueprint } from "../../lib/hiring/presentation";
import { demoBlueprint } from "../fixtures/hiring-data";
import { directorySchema } from "../../lib/candidates/contracts";

test("manual candidates, real Excel import, bulk assignments and overall hiring status", async ({
  page,
  browser,
}, info) => {
  const suffix = Date.now() + "-" + info.project.name;
  const names = [
    "Directory Manual " + suffix,
    "Directory Excel A " + suffix,
    "Directory Excel B " + suffix,
  ];
  const emails = [
    "manual-" + suffix + "@example.test",
    "excel-a-" + suffix + "@example.test",
    "excel-b-" + suffix + "@example.test",
  ];
  await page.goto("/enterprise/candidates");
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .first()
    .click();
  const add = page.getByRole("dialog", { name: "Add candidate", exact: true });
  await add.getByLabel("Name", { exact: true }).fill(names[0]);
  await add.getByLabel("Email", { exact: true }).fill(emails[0]);
  await add
    .getByLabel("Position (optional)", { exact: true })
    .fill("Marketing Analyst");
  await add.getByRole("button", { name: "Add candidate", exact: true }).click();
  await expect(add).toBeHidden();
  await expect(
    page.getByRole("button", { name: names[0], exact: true }),
  ).toBeVisible();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Applicants");
  sheet.addRows([
    ["Person", "Contact", "Opening"],
    [names[1], emails[1], "Analyst"],
    ["Duplicate", emails[0], ""],
    ["Invalid", "not-an-email", ""],
    [names[2], emails[2], "Marketer"],
    ["Duplicate in file", emails[1], ""],
  ]);
  const bytes = await workbook.xlsx.writeBuffer();
  await page
    .getByRole("button", { name: "Import candidates", exact: true })
    .click();
  const importer = page.getByRole("dialog", {
    name: "Import candidates",
    exact: true,
  });
  await importer.getByLabel("Candidate spreadsheet").setInputFiles({
    name: "applicants.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(bytes),
  });
  await importer.getByLabel("name column", { exact: true }).selectOption("0");
  await importer.getByLabel("email column", { exact: true }).selectOption("1");
  await importer
    .getByLabel("position column", { exact: true })
    .selectOption("2");
  await expect(importer.getByRole("status")).toContainText(
    "2 ready · 2 duplicates · 1 invalid",
  );
  await importer
    .getByRole("button", { name: "Import 2 candidates", exact: true })
    .click();
  await expect(importer).toBeHidden();
  await page.getByLabel("Search candidates").fill(suffix);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  await page
    .getByRole("checkbox", { name: "Select candidates on this page" })
    .check();
  const assessmentResponse = await page.request.post("/api/assessments", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      blueprint: publicBlueprint(demoBlueprint),
      status: "published",
      requestId: crypto.randomUUID(),
    },
  });
  expect(assessmentResponse.ok()).toBe(true);
  const { assessment } = await assessmentResponse.json();
  await page
    .getByRole("button", { name: "Assign assessment (3)", exact: true })
    .click();
  const assign = page.getByRole("dialog", {
    name: "Assign assessment",
    exact: true,
  });
  await assign
    .getByLabel("Published assessment", { exact: true })
    .selectOption(assessment.id);
  await assign
    .getByRole("button", { name: "Assign and create links", exact: true })
    .click();
  await expect(assign).toBeHidden();
  await expect(page.getByRole("status")).toContainText(
    "3 assessments assigned",
  );
  await expect(
    page.getByRole("table").getByText("1 assigned", { exact: true }),
  ).toHaveCount(3);
  await page.getByRole("button", { name: names[0], exact: true }).click();
  const detail = page.getByRole("dialog", { name: names[0], exact: true });
  await detail
    .getByLabel("Candidate hiring status")
    .selectOption("follow-up-required");
  await expect(detail.getByLabel("Candidate hiring status")).toHaveValue(
    "follow-up-required",
  );
  await detail.getByRole("button", { name: "Show link", exact: true }).click();
  const url = await detail
    .getByLabel("Invitation link for Junior Digital Marketing Specialist", {
      exact: true,
    })
    .inputValue();
  await detail.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByLabel("Search candidates").fill(suffix);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: names[0], exact: true }) });
  await expect(
    row.getByRole("cell", { name: "Follow-up required", exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const candidate = await context.newPage();
  await candidate.goto(url);
  await candidate.getByRole("button", { name: "Start assessment" }).click();
  await expect(
    candidate.getByLabel("Your response", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh candidates" }).click();
  await expect(
    row.getByRole("cell", { name: "In progress", exact: true }),
  ).toBeVisible();
  const directory = directorySchema.parse(
    await (await page.request.get("/api/candidates")).json(),
  );
  const record = directory.candidates.find((c) => c.email === emails[0])!;
  expect(record.decision).toBe("follow-up-required");
  expect(record.assignments[0].progress).toBe("in-progress");
  expect((await candidate.request.get("/api/candidates")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/candidates", {
        headers: { Origin: "https://wrong-origin.example" },
        data: { name: "No", email: "no@example.test", position: "" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/candidates/import", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: {
          candidates: [{ name: "Bad", email: "invalid", position: "" }],
          requestId: crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(400);
  await context.close();
  await page.screenshot({
    path: info.outputPath("candidate-directory.png"),
    fullPage: true,
  });
});
