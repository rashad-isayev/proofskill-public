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
test("monitoring requires consent, camera and fullscreen; failed signals preserve answers and retry", async ({
  page,
}) => {
  await setup(page);
  await mockDevices(page);
  let fail = true;
  const ids: string[] = [];
  await page.route("**/api/simulations/s1/monitoring/events", (r) => {
    expect(r.request().headers().authorization).toBe("Bearer private-token");
    const body = r.request().postDataJSON();
    ids.push(body.events[0].id);
    expect(Object.keys(body.events[0]).sort()).toEqual([
      "id",
      "kind",
      "occurredAt",
    ]);
    return r.fulfill({
      status: fail ? 503 : 200,
      json: fail
        ? { error: { message: "Unavailable" } }
        : {
            saved: true,
            state: { fullscreenWarnings: 1, disqualified: false },
          },
    });
  });
  await page.goto(host + "/monitoring-candidate");
  const start = page.getByRole("button", {
    name: "Start assessment",
    exact: true,
  });
  await expect(start).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Enable camera and screen capture" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await expect(start).toBeDisabled();
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(start).toBeEnabled();
  await start.click();
  const answer = page.getByLabel("Your response", { exact: true });
  await answer.fill("Preserve my evidence-based response.");
  await expect(
    page.getByRole("heading", { name: "Monitoring active" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByLabel("Local camera preview")).toBeHidden();
  const monitoring = page.getByLabel("Assessment monitoring", { exact: true });
  expect((await monitoring.boundingBox())!.height).toBeLessThan(180);
  await page.evaluate(() => document.exitFullscreen());
  const submit = page.getByRole("button", {
    name: "Submit response",
    exact: true,
  });
  await expect(submit).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Assessment paused", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be saved" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be saved" }),
  ).toHaveCount(0);
  expect(ids[0]).toBe(ids[1]);
  await page
    .getByRole("button", { name: "Return to fullscreen and resume" })
    .click();
  await expect(submit).toBeEnabled();
  await answer.dispatchEvent("paste");
  await expect.poll(() => ids.length).toBe(3);
  const cameraTrack = await page
    .getByLabel("Local camera preview")
    .evaluateHandle(
      (el) =>
        (el as HTMLVideoElement).srcObject &&
        ((el as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0],
    );
  const privacy = page.locator("summary", { hasText: "Privacy & controls" });
  await privacy.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Local camera preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Stop capture and withdraw consent" })
    .click();
  await expect(submit).toHaveCount(0);
  expect(await cameraTrack.evaluate((track) => track && track.readyState)).toBe(
    "ended",
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await expect(answer).toHaveValue("Preserve my evidence-based response.");
  await expect(
    page.getByRole("heading", { name: "Monitoring active" }),
  ).toBeVisible();
});
test("camera denial blocks monitored start without requesting audio", async ({
  page,
}) => {
  await setup(page);
  await mockDevices(page, true);
  await page.goto(host + "/monitoring-candidate");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera access was blocked",
  );
  await expect(
    page.getByRole("button", { name: "Start assessment", exact: true }),
  ).toBeDisabled();
});
test("missing policy fails closed; standard policy requires no camera", async ({
  page,
}) => {
  await setup(page, false);
  await page.route("**/api/invites/private-token/monitoring", (r) =>
    r.fulfill({
      status: 503,
      json: { error: { message: "Policy unavailable" } },
    }),
  );
  await page.goto(host + "/monitoring-candidate");
  await expect(
    page.getByRole("button", { name: "Start assessment", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Policy unavailable");
  await page.unroute("**/api/invites/private-token/monitoring");
  await page.route("**/api/invites/private-token/monitoring", (r) =>
    r.fulfill({
      json: { policy: { ...policy, enabled: false }, state: initialState },
    }),
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start assessment", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("HR monitoring selection saves through the policy API and reports failures honestly", async ({
  page,
}) => {
  let current = { ...policy, enabled: false };
  let fail = true;
  await page.route("**/api/assessments/a1/monitoring", (r) => {
    if (r.request().method() === "PUT") {
      const body = r.request().postDataJSON();
      expect(body.version).toBe(1);
      if (fail)
        return r.fulfill({
          status: 409,
          json: { error: { message: "Policy version changed" } },
        });
      current = {
        ...current,
        enabled: body.enabled,
        restrictClipboard: body.restrictClipboard,
      };
    }
    return r.fulfill({ json: { policy: current } });
  });
  await page.goto(host + "/monitoring-settings");
  await page
    .getByRole("checkbox", {
      name: "Require camera, entire-screen capture, and fullscreen",
    })
    .check();
  await page.getByRole("button", { name: "Save monitoring policy" }).click();
  await expect(page.getByRole("alert")).toContainText("Policy version changed");
  await expect(page.getByRole("status")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Save monitoring policy" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Monitoring policy saved",
  );
  await expect(
    page.getByRole("checkbox", {
      name: "Require camera, entire-screen capture, and fullscreen",
    }),
  ).toBeChecked();
});

test("three distinct fullscreen exits pause tasks then disqualify and release capture", async ({
  page,
}) => {
  await setup(page);
  await mockDevices(page);
  let state = { ...initialState };
  const seen = new Set<string>();
  await page.route("**/api/simulations/s1/monitoring/events", (r) => {
    const e = r.request().postDataJSON().events[0];
    if (!seen.has(e.id) && e.kind === "fullscreen-exit") {
      seen.add(e.id);
      state = {
        fullscreenWarnings: Math.min(3, state.fullscreenWarnings + 1),
        disqualified: state.fullscreenWarnings >= 2,
      };
    }
    return r.fulfill({ json: { saved: true, state } });
  });
  await page.goto(host + "/monitoring-candidate");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start assessment", exact: true })
    .click();
  await expect(page.getByLabel("Your response", { exact: true })).toBeVisible();
  const track = await page
    .getByLabel("Local camera preview")
    .evaluateHandle(
      (el) =>
        ((el as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0],
    );
  for (let count = 1; count <= 3; count++) {
    await page.evaluate(() => document.exitFullscreen());
    if (count < 3) {
      await expect(page.getByRole("alert")).toContainText(
        "Warning " + count + " of 3",
      );
      await expect(
        page.getByLabel("Your response", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Return to fullscreen and resume" })
        .click();
      await expect(
        page.getByLabel("Your response", { exact: true }),
      ).toBeVisible();
    }
  }
  await expect(
    page.getByRole("heading", { name: "You have been disqualified." }),
  ).toBeVisible();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Return to fullscreen and resume" }),
  ).toHaveCount(0);
  expect(await track.evaluate((t) => t.readyState)).toBe("ended");
  // Restore authoritative terminal state: refreshing must not silently grant a new attempt.
  await page.unroute("**/api/invites/private-token/monitoring");
  await page.route("**/api/invites/private-token/monitoring", (r) =>
    r.fulfill({
      json: { policy, state: { fullscreenWarnings: 3, disqualified: true } },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You have been disqualified." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start assessment", exact: true }),
  ).toHaveCount(0);
});

test("tab-only capture is rejected before an assessment starts", async ({
  page,
}) => {
  await setup(page);
  await mockDevices(page);
  await page.goto(host + "/monitoring-candidate");
  await page.evaluate(() => {
    navigator.mediaDevices.getDisplayMedia = async () => {
      const media = document.createElement("canvas").captureStream(1);
      media.getVideoTracks()[0].getSettings = () => ({
        displaySurface: "browser",
      });
      return media;
    };
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Select Entire Screen");
  await expect(
    page.getByRole("button", { name: "Start assessment", exact: true }),
  ).toBeDisabled();
});

test("stopping screen capture hides tasks and requires a new capture permission", async ({
  page,
}) => {
  await setup(page);
  await mockDevices(page);
  await page.route("**/api/simulations/s1/monitoring/events", (r) =>
    r.fulfill({ json: { saved: true, state: initialState } }),
  );
  await page.goto(host + "/monitoring-candidate");
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getDisplayMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getDisplayMedia = async (options) => {
      const stream = await original(options);
      Object.defineProperty(window, "screenFixtureTrack", {
        value: stream.getVideoTracks()[0],
        configurable: true,
      });
      return stream;
    };
  });
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Enable camera and screen capture" })
    .click();
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start assessment", exact: true })
    .click();
  await expect(page.getByLabel("Your response", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (
      window as unknown as { screenFixtureTrack: MediaStreamTrack }
    ).screenFixtureTrack.dispatchEvent(new Event("ended"));
  });
  await expect(
    page.getByRole("heading", { name: "Assessment paused", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Return to fullscreen and resume" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enable camera and screen capture" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fullscreen warnings: 0 / 3", { exact: true }),
  ).toBeVisible();
});

test("workspace panels scroll independently while the conversation composer stays in place", async ({
  page,
}, info) => {
  await setup(page, false);
  const session = candidate();
  session.companyContext = "Company context. ".repeat(150);
  session.facts = Object.fromEntries(
    Array.from({ length: 50 }, (_, i) => ["metric_" + i, i * 100]),
  );
  session.documents = Array.from({ length: 20 }, (_, i) => ({
    ...session.documents[0],
    id: "resource-" + i,
    title: "Reference document " + i,
  }));
  session.messages = Array.from({ length: 18 }, (_, i) => ({
    id: "long-" + i,
    role: i % 2 ? ("candidate" as const) : ("manager" as const),
    content: ("Message " + i + " with detailed workplace evidence. ").repeat(
      12,
    ),
    createdAt: new Date().toISOString(),
    turn: Math.min(6, Math.floor(i / 2)),
  }));
  await page.route("**/api/simulations/start", (r) =>
    r.fulfill({ json: { session } }),
  );
  await page.goto(host + "/monitoring-candidate");
  await page
    .getByRole("button", { name: "Start assessment", exact: true })
    .click();
  const composer = page.locator(".candidate-composer");
  await expect(page.getByLabel("Your response", { exact: true })).toBeVisible();
  const before = await composer.boundingBox();
  const chat = page.getByRole("list", { name: "Assessment conversation" });
  await chat.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect
    .poll(async () => Math.round((await composer.boundingBox())!.y))
    .toBe(Math.round(before!.y));
  if (info.project.name === "desktop") {
    const left = page.getByRole("complementary", {
      name: "Company context and activity",
    });
    const right = page.getByRole("complementary", {
      name: "Reference information",
    });
    await left.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await right.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(async () => Math.round((await composer.boundingBox())!.y))
      .toBe(Math.round(before!.y));
    expect(await right.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  } else {
    await page.getByRole("button", { name: "Reference", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Company data" }),
    ).toBeVisible();
    await expect(composer).toBeHidden();
    await page.getByRole("button", { name: "Company", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: session.companyName }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Conversation", exact: true })
      .click();
    await expect(composer).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("stable-assessment-workspace.png"),
  });
});
