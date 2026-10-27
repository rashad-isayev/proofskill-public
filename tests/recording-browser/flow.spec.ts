import { test, expect } from "../fixtures/auth";
import { publicBlueprint } from "../../lib/hiring/presentation";
import { demoBlueprint } from "../fixtures/hiring-data";
const Origin = "http://127.0.0.1:3100";
// Requires an isolated dev server with recording enabled and test-only retention/storage.
test("candidate records synthetic camera/screen privately and HR plays the saved video", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
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
  const invited = await page.request.post(`/api/assessments/${a.id}/invites`, {
    headers: { Origin },
    data: {
      candidateName: "Synthetic recording acceptance",
      candidateEmail: `recording-${Date.now()}@example.test`,
      assessmentVersion: a.version,
      requestId: crypto.randomUUID(),
    },
  });
  expect(invited.ok(), await invited.text()).toBe(true);
  const invitation = (await invited.json()).invite;
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
    const stream = () => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 180;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#223344";
      ctx.fillRect(0, 0, 320, 180);
      const timer = window.setInterval(() => {
        ctx.fillStyle = Date.now() % 2 ? "#223344" : "#334455";
        ctx.fillRect(0, 0, 320, 180);
      }, 100);
      const stream = c.captureStream(10);
      stream
        .getVideoTracks()[0]
        .addEventListener("ended", () => clearInterval(timer));
      return stream;
    };
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => stream(),
        getDisplayMedia: async () => {
          const s = stream();
          s.getVideoTracks()[0].getSettings = () => ({
            displaySurface: "monitor",
          });
          return s;
        },
      },
    });
  });
  try {
    await candidate.goto(`${Origin}/invite/${invitation.token}`);
    await expect(
      candidate.getByText(/video will be recorded without audio/),
    ).toBeVisible();
    await candidate
      .getByRole("checkbox", {
        name: /I consent to recording under this retention policy/,
      })
      .check();
    await candidate
      .getByRole("checkbox", {
        name: /I consent to camera and entire-screen capture/,
      })
      .check();
    await candidate
      .getByRole("button", { name: "Enable camera and screen capture" })
      .click();
    await candidate
      .getByRole("button", { name: "Enter fullscreen", exact: true })
      .click();
    // Confirm a fresh lease after cold route compilation before starting the attempt.
    const ready = await candidate.request.post(
      `${Origin}/api/invites/${invitation.token}/monitoring/ready`,
      {
        headers: { Origin, Authorization: "Bearer " + invitation.token },
        data: { policyVersion: a.monitoring.version, fullscreenWarnings: 0 },
      },
    );
    expect(ready.ok(), await ready.text()).toBe(true);
    await candidate
      .getByRole("button", { name: "Start assessment", exact: true })
      .click();
    await expect(
      candidate
        .getByRole("status")
        .filter({ hasText: "Camera and screen video are recording" }),
    ).toBeVisible();
    // Wait for actual uploaded frames before withdrawing, including cold route compilation.
    await expect
      .poll(
        async () => {
          const r = await page.request.get(
            `/api/assessments/${a.id}/recordings`,
          );
          return (await r.json()).recordings.filter(
            (x: { chunks: number }) => x.chunks > 0,
          ).length;
        },
        { timeout: 45000 },
      )
      .toBeGreaterThanOrEqual(2);
    await candidate.getByText("Privacy & controls", { exact: true }).click();
    await candidate
      .getByRole("button", { name: "Stop capture and withdraw consent" })
      .click();
    await expect
      .poll(
        async () => {
          const r = await page.request.get(
            `/api/assessments/${a.id}/recordings`,
          );
          return (await r.json()).recordings.filter(
            (x: { chunks: number; status: string }) =>
              x.chunks > 0 && x.status === "interrupted",
          ).length;
        },
        { timeout: 30000 },
      )
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(
        async () => {
          const r = await page.request.get(
            `/api/assessments/${a.id}/recordings`,
          );
          return (await r.json()).recordings.every(
            (x: { status: string }) => x.status === "interrupted",
          );
        },
        { timeout: 30000 },
      )
      .toBe(true);
    const recordings = (
      await (
        await page.request.get(`/api/assessments/${a.id}/recordings`)
      ).json()
    ).recordings;
    for (const r of recordings) {
      expect(r.status).toBe("interrupted");
      const denied = await candidate.request.get(
        `/api/recordings/${r.id}/playback`,
      );
      expect(denied.status()).toBe(401);
    }
    await page.goto(`/enterprise/assessments/${a.id}`);
    await page
      .getByRole("button", { name: "Review video", exact: true })
      .first()
      .click();
    const video = page.getByLabel("Private assessment recording");
    await expect(video).toBeVisible();
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), {
        timeout: 30000,
      })
      .toBe(320);
  } finally {
    await context.close();
  }
});
