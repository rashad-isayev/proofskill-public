import { test, expect } from "@playwright/test";
import { candidate, secondCandidate } from "./candidate-fixtures";
import { assessment, invite, report } from "./fixtures";

// Shared shell checks exercise the real screens with explicit intercepted records.
test("HR screens remain readable and navigable in both themes and viewport sizes", async ({
  page,
}, info) => {
  await page.route("**/api/assessments", (r) =>
    r.fulfill({ json: { assessments: [assessment] } }),
  );
  await page.route("**/api/assessments/a1", (r) =>
    r.fulfill({ json: { assessment, invites: [invite] } }),
  );
  await page.route("**/api/reports/r1", (r) => r.fulfill({ json: { report } }));
  await page.route("**/api/candidates", (r) =>
    r.fulfill({ json: { candidates: [candidate, secondCandidate] } }),
  );
  const screens = [
    ["/enterprise/assessments", "Assessments"],
    ["/enterprise/candidates", "Candidates"],
    ["/enterprise/reports", "Reports"],
    ["/enterprise/assessments/a1", assessment.blueprint.roleTitle],
    ["/enterprise/reports/r1", report.candidateName],
    ["/enterprise/compare", "Compare candidates"],
    ["/enterprise/assessments/a1/edit", "Review the blueprint."],
  ];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [path, heading] of screens) {
      await page.goto("http://127.0.0.1:3200" + path + "?shell");
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (path === "/enterprise/assessments") {
        await page
          .getByRole("button", { name: "Create AI Assessment" })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByLabel("Job title", { exact: true }),
        ).toBeVisible();
        const bounds = await dialog.boundingBox();
        expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
      await page.screenshot({
        path: info.outputPath(
          path.replaceAll("/", "-") + "-" + colorScheme + ".png",
        ),
        fullPage: true,
      });
    }
  }
});
