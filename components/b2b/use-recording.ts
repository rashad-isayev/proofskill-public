"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/b2b/client";
import { recordingPolicyEnvelope } from "@/lib/recording/contracts";
import { RecordingUpload } from "@/lib/recording/client";
export function useRecording({
  token,
  sessionId,
  configured,
  consent,
  active,
  camera,
  screen,
}: {
  token: string;
  sessionId?: string;
  configured: boolean;
  consent: boolean;
  active: boolean;
  camera: React.RefObject<MediaStream | null>;
  screen: React.RefObject<MediaStream | null>;
}) {
  const [policy, setPolicy] = useState<null | {
    enabled: boolean;
    retentionDays: number | null;
    notice: string;
  }>(null);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [revision, setRevision] = useState(0);
  const uploads = useRef<RecordingUpload[]>([]);
  const callbackAlive = useRef(true);
  useEffect(() => {
    callbackAlive.current = true;
    return () => {
      callbackAlive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    void api(
      `/api/invites/${encodeURIComponent(token)}/recording`,
      recordingPolicyEnvelope,
    )
      .then((r) => {
        if (alive) setPolicy(r.policy);
      })
      .catch(() => {
        if (alive)
          setError(
            "Recording requirements could not be loaded. Refresh before continuing.",
          );
      });
    return () => {
      alive = false;
    };
  }, [configured, token]);
  const allowed =
    !configured ||
    (!!policy && !policy.enabled) ||
    (!!policy && accepted && consent && !error);
  useEffect(() => {
    if (
      !configured ||
      !policy?.enabled ||
      !sessionId ||
      !active ||
      !accepted ||
      !consent
    )
      return;
    const streams = [camera.current, screen.current];
    if (streams.some((s) => !s)) return;
    let disposed = false;
    const update = (s: string) => {
      if (callbackAlive.current) {
        setMessage(s);
        if (/failed|interrupted|limit|could not|cannot|incomplete/i.test(s)) {
          setError(s);
          setStarted(false);
        }
      }
    };
    const batch: RecordingUpload[] = [];
    async function start() {
      setStarted(false);
      try {
        for (const [i, source] of (["camera", "screen"] as const).entries()) {
          const upload = new RecordingUpload(
            token,
            sessionId!,
            source,
            streams[i]!,
            policy!.retentionDays!,
            update,
          );
          batch.push(upload);
          uploads.current = batch;
          await upload.start();
          if (disposed) {
            await upload.finish(true);
            return;
          }
        }
        if (!disposed) {
          setStarted(true);
          setMessage(
            "Camera and screen video are recording and uploading privately.",
          );
        }
      } catch (e) {
        update(e instanceof Error ? e.message : "Recording could not start.");
        for (const u of batch) void u.finish(true).catch(() => {});
      }
    }
    void start();
    return () => {
      disposed = true;
      for (const u of batch) void u.finish(true).catch(() => {});
    };
  }, [
    configured,
    policy,
    sessionId,
    active,
    accepted,
    consent,
    camera,
    screen,
    token,
    revision,
  ]);
  async function finish(interrupted = false) {
    const batch = uploads.current;
    await Promise.all(batch.map((u) => u.finish(interrupted)));
  }
  async function retry() {
    try {
      if (!policy) {
        const r = await api(
          `/api/invites/${encodeURIComponent(token)}/recording`,
          recordingPolicyEnvelope,
        );
        if (callbackAlive.current) {
          setPolicy(r.policy);
          setError("");
        }
        return;
      }
      await finish(true);
      if (callbackAlive.current) {
        setError("");
        setMessage(
          "Saved recording segments are finalized. Re-enable capture to resume recording.",
        );
        setStarted(false);
        setRevision((n) => n + 1);
      }
    } catch (e) {
      if (callbackAlive.current)
        setError(
          e instanceof Error ? e.message : "Recording upload is incomplete.",
        );
    }
  }
  return {
    policy,
    accepted,
    setAccepted,
    message,
    error,
    allowed,
    ready: allowed && (!policy?.enabled || !sessionId || started),
    finish,
    retry,
  };
}
