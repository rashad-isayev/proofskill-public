import { test, expect, type Page } from "@playwright/test";
import { candidate, blueprint } from "./fixtures";
const initialState = { fullscreenWarnings: 0, disqualified: false };
const host = "http://127.0.0.1:3200";
const policy = {
  version: 1,
  enabled: true,
  restrictClipboard: true,
  notice:
    "This assessment requires camera access and fullscreen. Activity signals are reviewed by the hiring team.",
};
async function setup(page: Page, enabled = true) {
  await page.route("**/api/invites/private-token/monitoring/ready", (r) =>
    r.fulfill({
      json: {
        saved: true,
        state: {
          fullscreenWarnings: r.request().postDataJSON().fullscreenWarnings,
          disqualified: false,
        },
      },
    }),
  );
  await page.route("**/api/invites/private-token", (r) =>
    r.fulfill({
      json: {
        roleTitle: blueprint.roleTitle,
        durationMinutes: 15,
        demo: true,
        status: "invited",
        sessionId: null,
      },
    }),
  );
  await page.route("**/api/invites/private-token/monitoring", (r) =>
    r.fulfill({
      json: { policy: { ...policy, enabled }, state: initialState },
    }),
  );
  await page.route("**/api/invites/private-token/monitoring/consent", (r) =>
    r.fulfill({ json: { saved: true } }),
  );
  await page.route("**/api/simulations/start", (r) =>
    r.fulfill({ json: { session: candidate() } }),
  );
  await page.route("**/api/simulations/draft", (r) =>
    r.fulfill({ json: { saved: true } }),
  );
}
async function mockDevices(page: Page, denied = false) {
  await page.addInitScript(
    ({ denied }) => {
      let full: Element | null = null;
      Object.defineProperty(document, "fullscreenEnabled", { get: () => true });
      Object.defineProperty(document, "fullscreenElement", { get: () => full });
      Element.prototype.requestFullscreen = async () => {
        full = document.documentElement;
        document.dispatchEvent(new Event("fullscreenchange"));
      };
      document.exitFullscreen = async () => {
        full = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      };
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getDisplayMedia: async () => {
            const canvas = document.createElement("canvas");
            const media = canvas.captureStream(1);
            media.getVideoTracks()[0].getSettings = () => ({
              displaySurface: "monitor",
            });
            return media;
          },
          getUserMedia: async () => {
            if (denied)
              throw new DOMException(
                "Camera permission denied",
                "NotAllowedError",
              );
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 180;
            return canvas.captureStream(1);
          },
        },
      });
    },
    { denied },
  );
}
test("protection setup keeps checks and start together without nested scrolling", async ({
  page,
}, info) => {
  await setup(page);
  await mockDevices(page);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(host + "/monitoring-candidate");
  const steps = page.getByRole("list", { name: "Protection setup steps" });
  const monitoring = page.getByLabel("Assessment monitoring", { exact: true });
  const start = page.getByRole("button", {
    name: "Start assessment",
    exact: true,
  });
  await expect(steps).toBeVisible();
  await expect(start).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const box = await start.boundingBox();
  if (info.project.name === "mobile") {
    expect(box!.y + box!.height).toBeLessThanOrEqual(850);
    await page.getByText("How the assessment works", { exact: true }).click();
    await expect(
      page
        .getByText(
          "No account required. Return using this private invitation link.",
        )
        .last(),
    ).toBeVisible();
    await page.getByText("How the assessment works", { exact: true }).click();
  }
  if (info.project.name === "desktop") {
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);
  }
  expect(
    await monitoring.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("protection-setup.png"),
    fullPage: true,
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(start).toBeEnabled();
  await start.click();
  await expect(
    page.getByRole("heading", { name: "Monitoring active" }),
  ).toBeVisible();
  const privacy = page.locator("summary", { hasText: "Privacy & controls" });
  await privacy.click();
  const preview = page.getByLabel("Local camera preview");
  await expect(preview).toBeVisible();
  expect(
    await preview.evaluate(
      (el) =>
        ((el as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0]
          .readyState,
    ),
  ).toBe("live");
});

test("expanded privacy and permission errors remain reachable on short screens", async ({
  page,
}) => {
  await setup(page);
  await mockDevices(page, true);
  await page.setViewportSize({ width: 768, height: 500 });
  await page.goto(host + "/monitoring-candidate");
  await page.locator("summary", { hasText: "Privacy & controls" }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera access was blocked",
  );
  const start = page.getByRole("button", {
    name: "Start assessment",
    exact: true,
  });
  await start.scrollIntoViewIfNeeded();
  await expect(start).toBeInViewport();
  await expect(start).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const monitoring = page.getByLabel("Assessment monitoring", { exact: true });
  expect(
    await monitoring.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true);
});
