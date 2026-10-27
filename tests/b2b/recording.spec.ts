import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";

// Canvas provides synthetic video; these checks never request the user's camera/screen.
for (const failure of [false, true])
  test(`recording uploads real WebM and ${failure ? "recovers a failed chunk" : "finalizes privately"}`, async ({
    page,
  }) => {
    const bundled = await build({
      entryPoints: ["lib/recording/client.ts"],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "RecordingClient",
      platform: "browser",
    });
    const id = randomUUID();
    const chunks: Buffer[] = [];
    let failed = false;
    let finalized: unknown;
    await page.route("https://recording.test/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path === "/") {
        await route.fulfill({
          contentType: "text/html",
          body: "<html><body>Recording acceptance uses synthetic canvas video.</body></html>",
        });
        return;
      }
      if (path.endsWith("/recordings")) {
        await route.fulfill({
          json: {
            recording: {
              id,
              source: "camera",
              mime: "video/webm;codecs=vp9",
              status: "recording",
              chunks: 0,
              bytes: 0,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          },
        });
        return;
      }
      if (path.includes("/chunks/")) {
        expect(req.headers().authorization).toBe("Bearer " + "a".repeat(64));
        if (failure && !failed) {
          failed = true;
          await route.fulfill({
            status: 503,
            json: { error: { message: "Forced upload failure" } },
          });
          return;
        }
        const sequence = Number(path.split("/").at(-1));
        chunks[sequence] = req.postDataBuffer()!;
        await route.fulfill({ json: { saved: true } });
        return;
      }
      if (path.endsWith("/finalize")) {
        finalized = req.postDataJSON();
        await route.fulfill({
          json: {
            recording: {
              id,
              source: "camera",
              mime: "video/webm;codecs=vp9",
              status: (finalized as { interrupted: boolean }).interrupted
                ? "interrupted"
                : "complete",
              chunks: chunks.length,
              bytes: chunks.reduce((n, b) => n + b.length, 0),
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          },
        });
        return;
      }
      await route.fulfill({ status: 404 });
    });
    await page.goto("https://recording.test/");
    await page.addScriptTag({ content: bundled.outputFiles[0].text });
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#445566";
      ctx.fillRect(0, 0, 320, 180);
      const stream = canvas.captureStream(10);
      const Client = (
        window as unknown as {
          RecordingClient: {
            RecordingUpload: new (...args: unknown[]) => {
              start: () => Promise<void>;
              finish: () => Promise<void>;
            };
          };
        }
      ).RecordingClient.RecordingUpload;
      const upload = new Client(
        "a".repeat(64),
        "synthetic-session",
        "camera",
        stream,
        1,
        (message: string) => {
          document.body.dataset.status = message;
        },
      );
      (
        window as unknown as {
          testUpload: typeof upload;
          testStream: MediaStream;
        }
      ).testUpload = upload;
      (window as unknown as { testStream: MediaStream }).testStream = stream;
      await upload.start();
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await page.evaluate(async () => {
      const w = window as unknown as {
        testUpload: { finish: () => Promise<void> };
        testStream: MediaStream;
      };
      try {
        await w.testUpload.finish();
      } catch {
        await w.testUpload.finish();
      }
      w.testStream.getTracks().forEach((t) => t.stop());
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].subarray(0, 4)).toEqual(
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    );
    expect(finalized).toMatchObject({
      chunks: chunks.length,
      interrupted: failure,
    });
    const playable = await page.evaluate(async (data) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const video = document.createElement("video");
      video.muted = true;
      video.src = URL.createObjectURL(
        new Blob([bytes], { type: "video/webm" }),
      );
      document.body.append(video);
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("Recorded WebM cannot play"));
      });
      await video.play();
      const dimensions = { width: video.videoWidth, height: video.videoHeight };
      URL.revokeObjectURL(video.src);
      return dimensions;
    }, Buffer.concat(chunks).toString("base64"));
    expect(playable).toEqual({ width: 320, height: 180 });
  });
