import { test, expect } from "@playwright/test";
import { candidate, report } from "./fixtures";

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

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} system preference`, () => {
    test.use({ colorScheme: scheme, javaScriptEnabled: false });
    test("applies the device theme without client JavaScript", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const colors = await page.evaluate(() => ({
        scheme: getComputedStyle(document.documentElement).colorScheme,
        background: getComputedStyle(document.body).backgroundColor,
        foreground: getComputedStyle(document.body).color,
      }));
      expect(colors).toEqual(
        scheme === "light"
          ? {
              scheme: "light",
              background: "rgb(255, 255, 255)",
              foreground: "rgb(32, 33, 35)",
            }
          : {
              scheme: "dark",
              background: "rgb(33, 33, 33)",
              foreground: "rgb(236, 236, 236)",
            },
      );
    });
  });
}

test("live system changes preserve candidate work and update form controls", async ({
  page,
}, info) => {
  const session = candidate();
  let restores = 0;
  await page.route("**/api/invites/theme-token", (r) =>
    r.fulfill({
      json: {
        roleTitle: session.roleTitle,
        durationMinutes: 15,
        status: "in-progress",
        sessionId: session.id,
        demo: true,
      },
    }),
  );
  await page.route("**/api/simulations/s1", (r) => {
    restores++;
    return r.fulfill({ json: { session } });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/invite/theme-token");
  const answer = page.getByLabel("Your response", { exact: true });
  await answer.fill("Keep my draft when my device theme changes.");
  // Development Strict Mode may restore twice during the initial mount.
  const initialRestores = restores;
  expect(initialRestores).toBeGreaterThan(0);
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(answer).toHaveValue(
      "Keep my draft when my device theme changes.",
    );
    expect(
      await answer.evaluate((el) => getComputedStyle(el).colorScheme),
    ).toBe(scheme);
    expect(
      await answer.evaluate(
        (el) => getComputedStyle(el.closest("form")!).backgroundColor,
      ),
    ).toBe(scheme === "light" ? "rgb(247, 247, 247)" : "rgb(41, 41, 41)");
  }
  expect(restores).toBe(initialRestores);
  await page.screenshot({
    path: info.outputPath("candidate-light.png"),
    fullPage: true,
  });
});

test("report charts and service errors adapt to both palettes", async ({
  page,
}, info) => {
  await page.route("**/api/reports/r1", (r) => r.fulfill({ json: { report } }));
  await page.route("**/api/dashboard", (r) =>
    r.fulfill({
      status: 503,
      json: { error: { message: "Assessment service unavailable." } },
    }),
  );
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("http://127.0.0.1:3200/enterprise/reports/r1");
    const radar = page.getByRole("img", { name: /Missing evidence/ });
    await expect(radar).toBeVisible();
    expect(
      await radar
        .locator("circle")
        .first()
        .evaluate((el) => getComputedStyle(el).fill),
    ).toBe(scheme === "light" ? "rgb(107, 62, 210)" : "rgb(172, 150, 255)");
    if (scheme === "light")
      await page.screenshot({
        path: info.outputPath("report-light.png"),
        fullPage: true,
      });
    await page.goto("http://127.0.0.1:3200/enterprise");
    const error = page.getByRole("alert");
    await expect(error).toContainText("Assessment service unavailable.");
    expect(await error.evaluate((el) => getComputedStyle(el).color)).toBe(
      scheme === "light" ? "rgb(146, 80, 0)" : "rgb(252, 211, 77)",
    );
  }
});
