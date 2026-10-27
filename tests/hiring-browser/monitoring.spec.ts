import { test, expect } from "../fixtures/auth";
import { publicBlueprint } from "../../lib/hiring/presentation";
import { demoBlueprint } from "../fixtures/hiring-data";
const Origin = "http://127.0.0.1:3100";
test("real invitation monitoring persists warnings across reload and rejects closed task APIs", async ({
  page,
  browser,
}) => {
  const created = await page.request.post("/api/assessments", {
    headers: { Origin },
    data: {
      blueprint: publicBlueprint(demoBlueprint),
      status: "published",
      monitoring: { enabled: true, restrictClipboard: true },
      requestId: crypto.randomUUID(),
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const a = (await created.json()).assessment;
  const invited = await page.request.post(
    "/api/assessments/" + a.id + "/invites",
    {
      headers: { Origin },
      data: {
        candidateName: "Monitoring acceptance",
        candidateEmail: "monitoring-" + Date.now() + "@example.test",
        assessmentVersion: a.version,
        requestId: crypto.randomUUID(),
      },
    },
  );
  expect(invited.ok(), await invited.text()).toBe(true);
  const i = await invited.json();
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const candidate = await context.newPage();
  await candidate.addInitScript(() => {
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
          const m = document.createElement("canvas").captureStream(1);
          m.getVideoTracks()[0].getSettings = () => ({
            displaySurface: "monitor",
          });
          return m;
        },
        getUserMedia: async () =>
          document.createElement("canvas").captureStream(1),
      },
    });
  });
  try {
    const token = i.invite.token,
      headers = { Origin, Authorization: "Bearer " + token };
    expect(
      (
        await candidate.request.post("/api/simulations/start", {
          headers,
          data: { token },
        })
      ).status(),
    ).toBe(403);
    await candidate.goto(i.url);
    const start = candidate.getByRole("button", {
      name: "Start assessment",
      exact: true,
    });
    await expect(start).toBeDisabled();
    await candidate.getByRole("checkbox").check();
    await candidate
      .getByRole("button", { name: "Enable camera and screen capture" })
      .click();
    await candidate
      .getByRole("button", {
        name: /^(Enter fullscreen|Return to fullscreen and resume)$/,
        exact: true,
      })
      .click();
    await expect(start).toBeEnabled();
    await start.click();
    await expect(
      candidate.getByLabel("Your response", { exact: true }),
    ).toBeVisible();
    await candidate
      .getByLabel("Your response", { exact: true })
      .fill("Preserve this working draft.");
    await expect
      .poll(async () => {
        const response = await candidate.request.get("/api/invites/" + token);
        const { sessionId } = await response.json();
        const session = await candidate.request.get(
          "/api/simulations/" + sessionId,
          { headers },
        );
        return (await session.json()).session?.draft;
      })
      .toBe("Preserve this working draft.");
    await candidate.reload();
    await expect(
      candidate.getByRole("heading", { name: "Assessment paused" }),
    ).toBeVisible();
    await expect(
      candidate.getByLabel("Your response", { exact: true }),
    ).toHaveCount(0);
    await candidate.getByRole("checkbox").check();
    await candidate
      .getByRole("button", { name: "Enable camera and screen capture" })
      .click();
    await candidate
      .getByRole("button", {
        name: /^(Enter fullscreen|Return to fullscreen and resume)$/,
        exact: true,
      })
      .click();
    await expect(
      candidate.getByLabel("Your response", { exact: true }),
    ).toHaveValue("Preserve this working draft.");
    const entry = await (
      await candidate.request.get("/api/invites/" + token)
    ).json();
    for (let warning = 1; warning <= 3; warning++) {
      await candidate.evaluate(() => document.exitFullscreen());
      await expect
        .poll(
          async () =>
            (
              await (
                await candidate.request.get(
                  "/api/invites/" + token + "/monitoring",
                )
              ).json()
            ).state.fullscreenWarnings,
        )
        .toBe(warning);
      if (warning < 3) {
        expect(
          (
            await candidate.request.get("/api/simulations/" + entry.sessionId, {
              headers,
            })
          ).status(),
        ).toBe(403);
        expect(
          (
            await candidate.request.post("/api/simulations/start", {
              headers,
              data: { token, preview: true },
            })
          ).status(),
        ).toBe(403);
        await candidate
          .getByRole("button", { name: "Return to fullscreen and resume" })
          .click();
        await expect(
          candidate.getByLabel("Your response", { exact: true }),
        ).toBeVisible();
      }
    }
    await expect(
      candidate.getByRole("heading", { name: "You have been disqualified." }),
    ).toBeVisible();
    await candidate.reload();
    await expect(
      candidate.getByRole("heading", { name: "You have been disqualified." }),
    ).toBeVisible();
    await expect(
      candidate.getByLabel("Your response", { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await candidate.request.get("/api/simulations/" + entry.sessionId, {
          headers,
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await candidate.request.post("/api/simulations/draft", {
          headers,
          data: {
            sessionId: entry.sessionId,
            draft: "Overwrite",
            expectedTurns: 0,
          },
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await candidate.request.post("/api/simulations/start", {
          headers,
          data: { token, preview: true },
        })
      ).status(),
    ).toBe(410);
    expect(
      (
        await candidate.request.get("/api/assessments/" + a.id + "/monitoring")
      ).status(),
    ).toBe(401);
    const evidence = await (
      await page.request.get("/api/assessments/" + a.id + "/monitoring")
    ).json();
    expect(evidence.attempts[0].warnings).toBe(3);
    expect(evidence.attempts[0].disqualified).toBe(true);
  } finally {
    await context.close();
  }
});
