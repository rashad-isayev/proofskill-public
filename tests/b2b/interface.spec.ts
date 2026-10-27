import { test, expect } from "@playwright/test";
import { candidate, secondCandidate } from "./candidate-fixtures";

// Exercise real public pages, then the actual candidate components in the fixture host.
test("public pages and authentication share the neutral design and responsive navigation", async ({
  page,
}, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const path of [
      "/",
      "/how-it-works",
      "/for-enterprises",
      "/for-job-seekers",
      "/auth/sign-in",
      "/auth/sign-up",
      "/missing-interface-page",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const visual = await page.locator("body").evaluate((el) => {
        const css = getComputedStyle(el);
        return { font: css.fontFamily, background: css.backgroundColor };
      });
      expect(visual.font).toContain("system-ui");
      expect(visual.background).toBe(
        colorScheme === "light" ? "rgb(255, 255, 255)" : "rgb(33, 33, 33)",
      );
      if (path.startsWith("/auth/")) {
        const password = page.getByLabel("Password", { exact: true });
        await password.fill("Visible-only-when-requested");
        await expect(password).toHaveAttribute("type", "password");
        await page.getByRole("button", { name: "Show password" }).click();
        await expect(password).toHaveAttribute("type", "text");
        await page.getByRole("button", { name: "Hide password" }).click();
        await expect(password).toHaveValue("Visible-only-when-requested");
        await expect(password).toHaveAttribute("type", "password");
        expect(
          await password.evaluate((el) => el.getBoundingClientRect().height),
        ).toBe(44);
      }
      if (path === "/") {
        const menu = page.getByRole("button", {
          name: "Open navigation",
          exact: true,
        });
        if (await menu.isVisible()) {
          await menu.click();
          await expect(
            page
              .getByRole("navigation", { name: "Mobile navigation" })
              .getByRole("link"),
          ).toHaveCount(5);
          await page.keyboard.press("Escape");
          await expect(menu).toBeFocused();
          await expect(
            page.getByRole("navigation", { name: "Mobile navigation" }),
          ).toBeHidden();
        }
      }
      await page.screenshot({
        path: info.outputPath(
          (path === "/" ? "home" : path.replaceAll("/", "-")) +
            "-" +
            colorScheme +
            ".png",
        ),
        fullPage: true,
      });
    }
  }
});

test("candidate dialog has consistent controls, keyboard trapping and trigger focus restoration", async ({
  page,
}, info) => {
  await page.route("**/api/candidates", (r) =>
    r.fulfill({ json: { candidates: [candidate, secondCandidate] } }),
  );
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("http://127.0.0.1:3200/enterprise/candidates?shell");
    const trigger = page.getByRole("button", {
      name: "Add candidate",
      exact: true,
    });
    await expect(trigger).toBeEnabled();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Add candidate" });
    await expect(dialog).toBeVisible();
    const name = dialog.getByLabel("Name", { exact: true });
    await expect(dialog.locator(":focus")).toHaveCount(1);
    await name.fill("Preserved while changing theme");
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("dialog") !== null,
      ),
    ).toBe(true);
    const geometry = await dialog.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      border: getComputedStyle(el).borderTopWidth,
    }));
    expect(geometry.width).toBeLessThanOrEqual(page.viewportSize()!.width - 30);
    expect(geometry.border).toBe("0px");
    await page.screenshot({
      path: info.outputPath("candidate-dialog-" + colorScheme + ".png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});
