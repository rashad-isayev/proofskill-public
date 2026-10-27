"use client";
import { api } from "@/lib/b2b/client";
import { z } from "zod";
import { recordingStartEnvelope } from "./contracts";
const ack = z.object({ saved: z.literal(true) }).strict();
export type CaptureSource = "camera" | "screen";
/** Bounded, ordered upload queue. Failures stop capture and retain the queued blobs for retry. */
export class RecordingUpload {
  private recorder: MediaRecorder;
  private id = "";
  private queue: Blob[] = [];
  private sequence = 0;
  private total = 0;
  private sending = false;
  private stopped = false;
  private failed = false;
  private finalized = false;
  private finishing: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;
  private resolveStop: (() => void) | null = null;
  private key = crypto.randomUUID();
  constructor(
    private token: string,
    private sessionId: string,
    private source: CaptureSource,
    stream: MediaStream,
    private retentionDays: number,
    private status: (message: string) => void,
  ) {
    const mime = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime)
      throw new Error("This browser cannot record supported WebM video.");
    this.recorder = new MediaRecorder(
      new MediaStream(stream.getVideoTracks()),
      { mimeType: mime, videoBitsPerSecond: 350000 },
    );
    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      this.total++;
      if (e.data.size > 8388608 || this.queue.length >= 6) {
        this.failed = true;
        this.status(
          "Recording upload is interrupted: buffer limit reached. Stop and retry the saved chunks.",
        );
        this.stopRecorder();
        return;
      }
      this.queue.push(e.data);
      void this.flush();
    };
    this.recorder.onerror = () => {
      this.failed = true;
      this.status(
        "Recording was interrupted by the browser. Saved chunks remain available.",
      );
      this.stopRecorder();
    };
    this.recorder.onstop = () => {
      this.stopped = true;
      this.resolveStop?.();
    };
  }
  async start() {
    const r = await api(
      `/api/simulations/${encodeURIComponent(this.sessionId)}/recordings`,
      recordingStartEnvelope,
      {
        source: this.source,
        mime: this.recorder.mimeType,
        requestId: this.key,
        retentionDays: this.retentionDays,
        accepted: true,
      },
      "POST",
      this.token,
    );
    this.id = r.recording.id;
    if (this.stopped) {
      await this.finish(true);
      return;
    }
    this.recorder.start(10000);
  }
  private stopRecorder() {
    if (this.recorder.state !== "inactive") this.recorder.stop();
    else {
      this.stopped = true;
      this.resolveStop?.();
    }
  }
  async flush() {
    if (this.sending || !this.id) return;
    this.sending = true;
    try {
      while (this.queue.length) {
        const blob = this.queue[0];
        const r = await fetch(
          `/api/recordings/${encodeURIComponent(this.id)}/chunks/${this.sequence}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${this.token}`,
              "Content-Type": this.recorder.mimeType,
            },
            body: blob,
          },
        );
        if (!r.ok)
          throw new Error(
            "Video upload failed. Retry to save the queued chunks.",
          );
        ack.parse(await r.json());
        this.queue.shift();
        this.sequence++;
      }
      this.status(
        this.stopped
          ? "Recording upload saved."
          : "Recording and uploading privately.",
      );
    } catch (e) {
      this.failed = true;
      this.status(e instanceof Error ? e.message : "Recording upload failed.");
      this.stopRecorder();
    } finally {
      this.sending = false;
    }
  }
  finish(interrupted = false): Promise<void> {
    if (this.finalized) return Promise.resolve();
    if (this.finishing) return this.finishing;
    this.finishing = this.performFinish(interrupted).finally(() => {
      this.finishing = null;
    });
    return this.finishing;
  }
  private async performFinish(interrupted: boolean) {
    if (!this.stopping) {
      this.stopping = new Promise<void>((resolve) => {
        this.resolveStop = resolve;
      });
      this.stopRecorder();
    }
    await this.stopping;
    // ondataavailable queues the final blob before the stop event.
    while (this.sending)
      await new Promise((resolve) => setTimeout(resolve, 25));
    await this.flush();
    if (this.queue.length)
      throw new Error(
        "Recording upload is incomplete. Retry before leaving this page.",
      );
    if (!this.id) return;
    await api(
      `/api/recordings/${encodeURIComponent(this.id)}/finalize`,
      recordingStartEnvelope,
      { chunks: this.total, interrupted: interrupted || this.failed },
      "POST",
      this.token,
    );
    this.finalized = true;
  }
}
