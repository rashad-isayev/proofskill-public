"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ShieldCheck, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/b2b/client";
import {
  monitoringAck,
  candidateMonitoringEnvelope,
  monitoringEventAck,
  type MonitoringEventKind,
} from "@/lib/b2b/monitoring-contract";
import { useResource } from "@/lib/b2b/use-resource";
import { useRecording } from "./use-recording";
import { Failure, Loading } from "./common";
type Signal = { id: string; kind: MonitoringEventKind; occurredAt: string };
export function CandidateMonitoring({
  token,
  sessionId,
  onReady,
  onDisqualified,
  recordingConfigured = false,
  onRecordingFinalizer,
}: {
  token: string;
  recordingConfigured?: boolean;
  onRecordingFinalizer?: (
    finish: (interrupted?: boolean) => Promise<void>,
  ) => void;
  sessionId?: string;
  onReady: (ready: boolean) => void;
  onDisqualified?: (disqualified: boolean) => void;
}) {
  const { data, loading, error, reload } = useResource(
    "/api/invites/" + encodeURIComponent(token) + "/monitoring",
    candidateMonitoringEnvelope,
  );
  const [consent, setConsent] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [focused, setFocused] = useState(true);
  const [deviceError, setDeviceError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [signals, setSignals] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [serverTerminated, setServerTerminated] = useState(false);
  const warningCount = Math.max(warnings, data?.state.fullscreenWarnings ?? 0);
  const terminated =
    warningCount >= 3 || serverTerminated || data?.state.disqualified === true;
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const camera = useRef<MediaStream | null>(null);
  const screen = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const queue = useRef<Signal[]>([]);
  const session = useRef(sessionId);
  const strikes = useRef(0);
  const wasFullscreen = useRef(false);
  const preparation = useRef(0);
  const consentWrites = useRef<Promise<unknown>>(Promise.resolve());
  const sending = useRef(false);
  const lastEvent = useRef<Partial<Record<MonitoringEventKind, number>>>({});
  const [serverReady, setServerReady] = useState(false);
  const [readinessError, setReadinessError] = useState("");
  const [checkRevision, setCheckRevision] = useState(0);
  const enabled = data?.policy.enabled === true;
  const eligible =
    !!data &&
    !loading &&
    !error &&
    !terminated &&
    (!enabled ||
      (consent &&
        cameraReady &&
        screenReady &&
        fullscreen &&
        focused &&
        !deliveryError));
  const recording = useRecording({
    token,
    sessionId,
    configured: recordingConfigured && enabled,
    consent,
    active: eligible && serverReady,
    camera,
    screen,
  });
  useEffect(() => {
    onRecordingFinalizer?.(recording.finish);
  });
  const ready = eligible && (!enabled || serverReady) && recording.ready;
  useEffect(() => {
    if (!eligible || !enabled || !data) {
      return;
    }
    let active = true;
    async function confirm() {
      try {
        const result = await api(
          "/api/invites/" + encodeURIComponent(token) + "/monitoring/ready",
          monitoringEventAck,
          {
            policyVersion: data!.policy.version,
            fullscreenWarnings: warningCount,
          },
          "POST",
          token,
        );
        if (active) {
          setServerReady(true);
          setReadinessError("");
          if (result.state.disqualified) setServerTerminated(true);
        }
      } catch (error) {
        if (active) {
          if (error instanceof Error && error.message.includes("disqualified"))
            setServerTerminated(true);
          setServerReady(false);
          setReadinessError(
            "Monitoring readiness could not be confirmed. Retry before continuing.",
          );
        }
      }
    }
    void confirm();
    const interval = setInterval(() => void confirm(), 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [eligible, enabled, data, token, warningCount, checkRevision]);
  useEffect(() => {
    session.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);
  useEffect(() => {
    onDisqualified?.(terminated);
    if (terminated) {
      preparation.current++;
      camera.current?.getTracks().forEach((track) => track.stop());
      screen.current?.getTracks().forEach((track) => track.stop());
    }
  }, [terminated, onDisqualified]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      camera.current?.getTracks().forEach((track) => track.stop());
      screen.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  function saveConsent(accepted: boolean) {
    const version = data!.policy.version;
    // Stop locally immediately; finalize already captured chunks before storing withdrawal.
    const finalization = accepted
      ? Promise.resolve()
      : recording.finish(true).catch(() => {});
    const next = consentWrites.current
      .catch(() => {})
      .then(() => finalization)
      .then(() =>
        api(
          "/api/invites/" + encodeURIComponent(token) + "/monitoring/consent",
          monitoringAck,
          { accepted, policyVersion: version },
          "POST",
          token,
        ),
      );
    consentWrites.current = next;
    return next;
  }
  async function flush() {
    const currentSession = session.current;
    if (!currentSession || sending.current || !queue.current.length) return;
    sending.current = true;
    try {
      while (queue.current.length && alive.current) {
        const result = await api(
          "/api/simulations/" +
            encodeURIComponent(currentSession) +
            "/monitoring/events",
          monitoringEventAck,
          { events: [queue.current[0]] },
          "POST",
          token,
        );
        queue.current.shift();
        strikes.current = Math.max(
          strikes.current,
          result.state.fullscreenWarnings,
        );
        if (alive.current) {
          setWarnings((n) => Math.max(n, result.state.fullscreenWarnings));
          if (result.state.disqualified) setServerTerminated(true);
        }
      }
      if (alive.current) setDeliveryError("");
    } catch {
      if (alive.current)
        setDeliveryError(
          "Activity signals could not be saved. Your response is preserved. Retry to confirm the assessment status.",
        );
    } finally {
      sending.current = false;
    }
  }
  function signal(kind: MonitoringEventKind) {
    if (!session.current) return;
    const now = Date.now();
    if (
      kind !== "fullscreen-exit" &&
      now - (lastEvent.current[kind] || 0) < 2000
    )
      return;
    lastEvent.current[kind] = now;
    setSignals((n) => n + 1);
    if (queue.current.length >= 30) {
      setDeliveryError(
        "Activity signal queue is full. Retry before continuing.",
      );
      return;
    }
    queue.current.push({
      id: crypto.randomUUID(),
      kind,
      occurredAt: new Date(now).toISOString(),
    });
    void flush();
  }
  useEffect(() => {
    if (!enabled || terminated) return;
    function full() {
      const active = document.fullscreenElement === document.documentElement;
      const exited = wasFullscreen.current && !active;
      wasFullscreen.current = active;
      setFullscreen(active);
      if (!active) setServerReady(false);
      if (exited && sessionId) {
        const count = Math.min(
          3,
          Math.max(strikes.current, data!.state.fullscreenWarnings) + 1,
        );
        onReady(false);
        strikes.current = count;
        setWarnings(count);
        signal("fullscreen-exit");
      }
    }
    function visibility() {
      setFocused(document.visibilityState === "visible" && document.hasFocus());
      if (document.hidden) setServerReady(false);
      if (document.hidden && consent) signal("page-hidden");
    }
    function blur() {
      setFocused(false);
      setServerReady(false);
      if (consent) signal("window-blur");
    }
    function focus() {
      setFocused(!document.hidden);
    }
    function clipboard(event: Event) {
      if (!data?.policy.restrictClipboard || !sessionId) return;
      event.preventDefault();
      signal("clipboard-blocked");
    }
    document.addEventListener("fullscreenchange", full);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    const workspace = cameraVideo.current?.closest(".candidate-workplace");
    for (const name of ["copy", "cut", "paste"])
      workspace?.addEventListener(name, clipboard);
    return () => {
      document.removeEventListener("fullscreenchange", full);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      for (const name of ["copy", "cut", "paste"])
        workspace?.removeEventListener(name, clipboard);
    };
    // Event listeners use the same authorized session/policy for queued signal delivery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    terminated,
    sessionId,
    consent,
    data?.policy.restrictClipboard,
    data?.state.fullscreenWarnings,
    token,
  ]);
  async function prepare() {
    if (!consent || preparing || terminated || !recording.allowed) return;
    const attempt = ++preparation.current;
    setPreparing(true);
    setDeviceError("");
    let step: "screen" | "camera" = "screen";
    try {
      if (
        !navigator.mediaDevices?.getDisplayMedia ||
        !navigator.mediaDevices?.getUserMedia
      )
        throw new Error(
          "Camera and entire-screen capture require a supported desktop browser and HTTPS or localhost. Contact the hiring team for an alternative.",
        );
      camera.current?.getTracks().forEach((track) => track.stop());
      screen.current?.getTracks().forEach((track) => track.stop());
      setCameraReady(false);
      setScreenReady(false);
      // Screen selection requires a user click; fullscreen is a separate click after both permissions.
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
      });
      if (!alive.current || preparation.current !== attempt) {
        display.getTracks().forEach((track) => track.stop());
        return;
      }
      screen.current = display;
      const displayTrack = display.getVideoTracks()[0];
      if (
        !displayTrack ||
        displayTrack.getSettings().displaySurface !== "monitor"
      )
        throw new Error(
          "Select Entire Screen, not a browser tab or application window, to continue.",
        );
      displayTrack.addEventListener(
        "ended",
        () => {
          if (!alive.current) return;
          setScreenReady(false);
          setServerReady(false);
          signal("screen-ended");
        },
        { once: true },
      );
      step = "camera";
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 180 } },
        audio: false,
      });
      if (!alive.current || preparation.current !== attempt) {
        media.getTracks().forEach((track) => track.stop());
        display.getTracks().forEach((track) => track.stop());
        return;
      }
      camera.current = media;
      if (cameraVideo.current) cameraVideo.current.srcObject = media;
      const track = media.getVideoTracks()[0];
      if (!track)
        throw new Error(
          "A working camera is required. Contact the hiring team for an alternative.",
        );
      track.addEventListener(
        "ended",
        () => {
          if (!alive.current) return;
          setCameraReady(false);
          setServerReady(false);
          signal("camera-ended");
        },
        { once: true },
      );
      await saveConsent(true);
      if (!alive.current || preparation.current !== attempt) {
        media.getTracks().forEach((track) => track.stop());
        display.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraReady(track.readyState === "live");
      setScreenReady(displayTrack.readyState === "live");
    } catch (error) {
      camera.current?.getTracks().forEach((track) => track.stop());
      screen.current?.getTracks().forEach((track) => track.stop());
      setCameraReady(false);
      setScreenReady(false);
      setDeviceError(captureMessage(error, step));
    } finally {
      if (alive.current) setPreparing(false);
    }
  }
  async function enterFullscreen() {
    if (terminated || !consent || !cameraReady || !screenReady || deliveryError)
      return;
    try {
      if (!document.fullscreenEnabled)
        throw new Error(
          "Fullscreen is unavailable. Contact the hiring team for an alternative.",
        );
      await document.documentElement.requestFullscreen();
      wasFullscreen.current =
        document.fullscreenElement === document.documentElement;
      setFullscreen(wasFullscreen.current);
      setFocused(!document.hidden && document.hasFocus());
    } catch (error) {
      setDeviceError(
        error instanceof DOMException || !(error instanceof Error)
          ? "Fullscreen could not be enabled. Select Enter fullscreen again, or contact the hiring team for an alternative."
          : error.message,
      );
    }
  }
  function stop() {
    setServerReady(false);
    preparation.current++;
    camera.current?.getTracks().forEach((track) => track.stop());
    screen.current?.getTracks().forEach((track) => track.stop());
    camera.current = null;
    screen.current = null;
    if (cameraVideo.current) cameraVideo.current.srcObject = null;
    setCameraReady(false);
    setScreenReady(false);
    setConsent(false);
    if (data)
      void saveConsent(false).catch(() => {
        if (alive.current)
          setDeliveryError(
            "Capture stopped locally. Consent withdrawal could not be saved; contact the hiring team.",
          );
      });
  }
  if (loading)
    return <Loading label="Checking assessment monitoring requirements…" />;
  if (error) return <Failure message={error} retry={reload} />;
  if (terminated)
    return (
      <Card
        className="mx-auto my-8 max-w-2xl p-8"
        aria-label="Assessment disqualified"
      >
        <p className="text-xs text-warning">Assessment closed</p>
        <h1 className="mt-3 text-2xl font-semibold">
          You have been disqualified.
        </h1>
        <p className="mt-4 text-sm leading-6">
          {warningCount >= 3
            ? "You exited fullscreen three times. This assessment is closed and cannot be resumed."
            : "The hiring team has closed this monitored assessment."}{" "}
          Camera and screen capture have stopped. Contact the hiring team for
          review or an alternative assessment.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          This assessment status is not an automatic hiring decision. You may
          request a human review from the hiring team.
        </p>
        {deliveryError && (
          <Failure message={deliveryError} retry={() => void flush()} />
        )}
      </Card>
    );
  if (!enabled) return null;
  return (
    <Card
      className={
        sessionId
          ? "candidate-monitoring-strip mx-4 my-3 p-3 md:mx-6 md:px-4"
          : "w-full p-4 sm:p-5 lg:col-start-2 lg:row-start-1"
      }
      aria-label="Assessment monitoring"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium">
          <ShieldCheck
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          {sessionId && ready ? "Monitoring active" : "Assessment monitoring"}
        </h2>
        <div
          className={
            sessionId
              ? "flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground"
              : "hidden"
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <Camera className="size-3.5" aria-hidden="true" />
            Camera {cameraReady ? "on" : "required"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Monitor className="size-3.5" aria-hidden="true" />
            Screen {screenReady ? "shared" : "required"}
          </span>
          <span>Fullscreen {fullscreen ? "on" : "required"}</span>
          <span className={warningCount > 0 ? "font-medium text-warning" : ""}>
            Fullscreen warnings: {warningCount} / 3
          </span>
        </div>
      </div>
      {recordingConfigured && recording.policy?.enabled && (
        <label className="mt-3 flex items-start gap-2.5 text-xs leading-5">
          <input
            type="checkbox"
            checked={recording.accepted}

            onChange={(e) => recording.setAccepted(e.target.checked)}
            className="mt-1 shrink-0"
          />
          <span>
            {recording.policy.notice} I consent to recording under this
            retention policy.
          </span>
        </label>
      )}
      {recording.message && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {recording.message}
        </p>
      )}
      {recording.error && (
        <Failure
          message={recording.error}
          retry={() => void recording.retry()}
        />
      )}
      {!sessionId && (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Complete these checks before starting. Three fullscreen exits during
            the assessment close your attempt.
          </p>
          <ol
            aria-label="Protection setup steps"
            className="mt-4 space-y-3 text-sm"
          >
            {[
              {
                title: "Consent",
                detail: "Review the privacy controls and agree below.",
                complete: consent,
              },
              {
                title: "Camera and screen",
                detail:
                  "Allow your camera and choose Entire Screen when prompted.",
                complete: cameraReady && screenReady,
              },
              {
                title: "Fullscreen",
                detail: "Enter fullscreen to finish the setup.",
                complete: fullscreen,
              },
            ].map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium " +
                    (step.complete
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground")
                  }
                >
                  {step.complete ? "✓" : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">
                    {step.title}
                    {step.complete && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Ready
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 hidden text-xs leading-5 text-muted-foreground sm:block">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      {(!sessionId || !consent || !cameraReady || !screenReady) && (
        <label className="mt-3 flex items-start gap-2.5 text-xs leading-5">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => {
              if (!event.target.checked) stop();
              else setConsent(true);
            }}
            className="mt-1 shrink-0"
          />
          I consent to camera and entire-screen capture and understand the
          three-warning fullscreen rule.
        </label>
      )}
      <p role="status" className="sr-only">
        {ready
          ? "Ready to continue."
          : "Task access paused. Complete the checks to continue."}
      </p>
      {sessionId && !fullscreen && warningCount > 0 && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5 text-xs leading-5"
        >
          <strong>Warning {warningCount} of 3: You exited fullscreen.</strong>
          <p>
            Tasks are paused. Return to fullscreen to resume.
            {warningCount === 2
              ? " Your next exit will disqualify you."
              : " Three exits close the assessment."}{" "}
            The timer continues.
          </p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(!cameraReady || !screenReady || !consent) && (
          <Button
            type="button"
            size="sm"
            className={sessionId ? "h-8 text-xs" : "w-full text-xs"}
            disabled={!consent || preparing || !recording.allowed}
            onClick={() => void prepare()}
          >
            {preparing ? "Preparing…" : "Enable camera and screen capture"}
          </Button>
        )}
        {cameraReady &&
          screenReady &&
          (!fullscreen || !focused || !!deliveryError) && (
            <Button
              type="button"
              size="sm"
              className={sessionId ? "h-8 text-xs" : "w-full text-xs"}
              disabled={!consent || !!deliveryError}
              onClick={() => void enterFullscreen()}
            >
              {sessionId
                ? "Return to fullscreen and resume"
                : "Enter fullscreen"}
            </Button>
          )}
      </div>
      <details
        className={
          sessionId && ready
            ? "mt-1 text-[11px] text-muted-foreground"
            : "mt-3 text-[11px] text-muted-foreground"
        }
      >
        <summary className="w-fit cursor-pointer rounded py-1 hover:text-foreground">
          Privacy &amp; controls
        </summary>
        <div className="mt-2 grid gap-3 border-t border-border pt-3 sm:grid-cols-[112px_1fr]">
          <video
            ref={cameraVideo}
            muted
            autoPlay
            playsInline
            aria-label="Local camera preview"
            className="aspect-video w-28 rounded-lg bg-secondary object-cover"
          />
          <div className="space-y-2 leading-5">
            <p>
              {recording.policy?.enabled
                ? "Camera, Entire Screen and fullscreen are required. Three fullscreen exits close the attempt. Activity signals support human review."
                : data.policy.notice}
            </p>
            <p>
              Close private windows and notifications before sharing your
              screen. No audio is requested.{" "}
              {recording.policy?.enabled
                ? "Video is recorded under the disclosed retention policy."
                : "No video is recorded or uploaded in this version."}
            </p>
            <p>
              Tasks pause when checks are lost; the assessment timer continues.
              You can stop capture or exit fullscreen at any time. Contact the
              hiring team if you need an alternative.
            </p>
            <p>Activity signals this visit: {signals}</p>
            {consent && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={stop}
              >
                Stop capture and withdraw consent
              </Button>
            )}
          </div>
        </div>
      </details>
      {!sessionId && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {recording.policy?.enabled
            ? "Recording starts after the assessment begins."
            : "Local camera/screen preview only. Nothing is recorded or uploaded."}
        </p>
      )}
      {readinessError && (
        <Failure
          message={readinessError}
          retry={() => setCheckRevision((n) => n + 1)}
        />
      )}
      {deviceError && <Failure message={deviceError} />}
      {deliveryError && (
        <Failure message={deliveryError} retry={() => void flush()} />
      )}
    </Card>
  );
}

// Browsers report capture failures as terse DOMExceptions ("Permission denied");
// translate them into steps a candidate can act on.
function captureMessage(error: unknown, step: "screen" | "camera") {
  const name = error instanceof DOMException ? error.name : "";
  const device = step === "screen" ? "Screen sharing" : "Camera access";
  if (name === "NotAllowedError" || name === "SecurityError")
    return step === "screen"
      ? "Screen sharing was cancelled or blocked. Select Enable camera and screen capture again and choose Entire Screen. On a Mac, also allow your browser under System Settings → Privacy & Security → Screen Recording."
      : "Camera access was blocked. Allow the camera for this site using the icon in your browser’s address bar (and for your browser in your computer’s privacy settings), then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera was found. Connect a camera and try again, or contact the hiring team for an alternative.";
  if (name === "NotReadableError" || name === "AbortError")
    return `${device} could not start. Close other apps that may be using it, then try again.`;
  if (error instanceof Error && !(error instanceof DOMException))
    return error.message;
  return "Capture could not start. Check your browser permissions and try again, or contact the hiring team for an alternative.";
}
