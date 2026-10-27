import { test, expect } from "@playwright/test";
const host = "http://127.0.0.1:3200";
test("private dashboard shell keeps navigation accessible in both system themes", async ({
  page,
}, info) => {
  await page.route("**/api/dashboard", (r) =>
    r.fulfill({
      json: {
        counts: {
          activePositions: 1,
          publishedAssessments: 2,
          invitedCandidates: 7,
          completedSimulations: 4,
          awaitingReview: 3,
        },
        activity: [],
        demo: true,
      },
    }),
  );
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(host + "/enterprise?shell");
    await expect(
      page.getByRole("heading", { name: "Hiring overview" }),
    ).toBeVisible();
    const menu = page.getByRole("button", {
      name: "Open workspace navigation",
    });
    if (await menu.isVisible()) await menu.click();
    const nav = page.getByRole("navigation", { name: "Workspace navigation" });
    await expect(
      nav.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "Compare", exact: true }),
    ).toHaveAttribute("href", "/enterprise/compare");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (
      await page
        .getByRole("button", { name: "Close workspace navigation" })
        .isVisible()
    ) {
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await expect(nav).toBeHidden();
    }
    await page.screenshot({
      path: info.outputPath("overview-" + scheme + ".png"),
      fullPage: true,
    });
  }
});
