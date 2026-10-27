"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Clock3 } from "lucide-react";
import {
  candidateViewSchema,
  inviteEntrySchema,
  type CandidateView,
} from "@/lib/contracts";
import { api } from "@/lib/b2b/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";
import { Demo, Failure, Loading } from "./common";
import { humanizeKey, isInternalKey } from "@/lib/utils";
import { candidateMonitoringEnvelope } from "@/lib/b2b/monitoring-contract";
import { CandidateMonitoring } from "./candidate-monitoring";
import { CandidateEntry } from "./candidate-entry";
import { CandidateTools } from "./candidate-tools";
const sessionEnvelope = z.object({ session: candidateViewSchema }).strict();
const completion = z.object({ status: z.literal("completed") }).strict();
type Entry = z.infer<typeof inviteEntrySchema>;
export function CandidateWorkspace({
  token,
  monitoringConnected = false,
  recordingConfigured = false,
}: {
  token: string;
  monitoringConnected?: boolean;
  recordingConfigured?: boolean;
}) {
  const [monitoringReady, setMonitoringReady] = useState(!monitoringConnected);
  const [monitoringDisqualified, setMonitoringDisqualified] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [session, setSession] = useState<CandidateView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [mobilePanel, setMobilePanel] = useState("chat");
  const conversation = useRef<HTMLOListElement>(null);
  const followConversation = useRef(true);
  const [now, setNow] = useState(() => Date.now());
  const [archived, setArchived] = useState(false);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const finalizeRecording = useRef<(interrupted?: boolean) => Promise<void>>(
    async () => {},
  );
  const setRecordingFinalizer = useCallback(
    (finish: (interrupted?: boolean) => Promise<void>) => {
      finalizeRecording.current = finish;
    },
    [],
  );
  const expirySubmitted = useRef(false);
  const failedAction = useRef<"load" | "start" | "respond" | "complete">(
    "load",
  );
  const request = useRef<{
    sessionId: string;
    message: string;
    requestId: string;
    expectedTurns: number;
  } | null>(null);
  const restore = useCallback(async () => {
    const entry = await api(
      "/api/invites/" + encodeURIComponent(token),
      inviteEntrySchema,
    );
    // Metadata is sufficient to set up monitoring; fetch tasks only after readiness.
    if (entry.status === "archived" || monitoringConnected)
      return { entry, session: null };
    const session =
      entry.sessionId && entry.status === "in-progress"
        ? (
            await api(
              "/api/simulations/" + encodeURIComponent(entry.sessionId),
              sessionEnvelope,
              undefined,
              "GET",
              token,
            )
          ).session
        : null;
    return { entry, session };
  }, [token, monitoringConnected]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    restore()
      .then(({ entry, session }) => {
        if (!active) return;
        if (entry.status === "archived" && monitoringConnected) {
          void api(
            "/api/invites/" + encodeURIComponent(token) + "/monitoring",
            candidateMonitoringEnvelope,
          )
            .then((d) => {
              if (active) {
                setMonitoringDisqualified(d.state.disqualified);
                setArchived(!d.state.disqualified);
              }
            })
            .catch(() => {
              if (active) setArchived(true);
            });
        } else setArchived(entry.status === "archived");
        setEntry(entry);
        setSession(session);
        setAnswer(session?.draft ?? "");
        setDone(
          entry.status === "completed" ||
            entry.status === "reviewed" ||
            session?.status === "completed",
        );
      })
      .catch((e) => {
        if (active) {
          if (e.message === "This session is archived.") setArchived(true);
          else setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [restore, refresh, monitoringConnected, token]);
  useEffect(() => {
    if (
      !monitoringConnected ||
      !monitoringReady ||
      !entry?.sessionId ||
      entry.status !== "in-progress" ||
      session ||
      loading
    )
      return;
    let active = true;
    void api(
      "/api/simulations/" + encodeURIComponent(entry.sessionId),
      sessionEnvelope,
      undefined,
      "GET",
      token,
    )
      .then(({ session: restored }) => {
        if (!active) return;
        setSession(restored);
        setAnswer(restored.draft ?? "");
        setError("");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [
    monitoringConnected,
    monitoringReady,
    entry,
    session,
    loading,
    token,
    refresh,
  ]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      !session ||
      session.status !== "in-progress" ||
      pending ||
      monitoringDisqualified
    )
      return;
    const t = setTimeout(() => {
      void api(
        "/api/simulations/draft",
        z.object({ saved: z.boolean() }),
        {
          sessionId: session.id,
          draft: answer,
          expectedTurns: session.turnsCompleted,
        },
        "POST",
        token,
      ).catch((e) => setError(e.message));
    }, 700);
    return () => clearTimeout(t);
  }, [answer, session, pending, token, monitoringDisqualified]);
  async function act(action: "start" | "respond" | "complete", retry = false) {
    if (
      busy.current ||
      monitoringDisqualified ||
      (monitoringConnected && !monitoringReady && action !== "complete")
    )
      return;
    if (action === "respond" && !retry) {
      if (!session || !answer.trim()) return;
      if (
        request.current?.sessionId !== session.id ||
        request.current?.message !== answer.trim()
      )
        request.current = {
          sessionId: session.id,
          message: answer.trim(),
          requestId: crypto.randomUUID(),
          expectedTurns: session.turnsCompleted,
        };
    }
    busy.current = true;
    setPending(true);
    setError("");
    failedAction.current = action;
    try {
      if (action === "complete") {
        if (!session) return;
        await finalizeRecording.current(false);
        await api(
          "/api/simulations/complete",
          completion,
          { sessionId: session.id },
          "POST",
          token,
        );
        setDone(true);
      } else {
        const result = await api(
          "/api/simulations/" + action,
          sessionEnvelope,
          action === "start" ? { token } : request.current,
          "POST",
          token,
        );
        setSession(result.session);
        if (action === "respond") {
          setAnswer("");
          request.current = null;
        }
        setDone(result.session.status === "completed");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We could not connect. Your response is preserved.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function retry() {
    if (failedAction.current === "load") {
      setLoading(true);
      setError("");
      failedAction.current = "load";
      setRefresh((v) => v + 1);
    } else
      void act(
        failedAction.current,
        failedAction.current !== "respond" || request.current !== null,
      );
  }
  useEffect(() => {
    if (followConversation.current && conversation.current)
      conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [session?.messages.length, pending, monitoringReady]);
  const seconds = session
    ? Math.max(0, Math.ceil((Date.parse(session.deadlineAt) - now) / 1000))
    : 0;
  const finish =
    session &&
    (session.status === "ready-to-complete" ||
      session.turnsCompleted >= session.maxTurns ||
      seconds === 0);
  useEffect(() => {
    if (
      !session ||
      seconds !== 0 ||
      done ||
      archived ||
      monitoringDisqualified ||
      expirySubmitted.current
    )
      return;
    expirySubmitted.current = true;
    void finalizeRecording
      .current(false)
      .catch(() => {})
      .then(() =>
        api(
          "/api/simulations/complete",
          completion,
          { sessionId: session.id },
          "POST",
          token,
        ),
      )
      .catch(() => {});
  }, [session, seconds, done, archived, token, monitoringDisqualified]);
  if (archived || done || (session && seconds === 0)) return null;
  return (
    <div
      className={
        "candidate-workplace bg-background " +
        (session && !monitoringDisqualified ? "is-active" : "min-h-screen")
      }
    >
      <header className="candidate-workplace-header flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 md:px-6">
        <Logo />
        <p className="text-xs text-muted-foreground">
          Private candidate assessment{" "}
          <Demo demo={session?.demo ?? entry?.demo ?? false} />
        </p>
        {session && !done && !monitoringDisqualified && (
          <div className="flex items-center gap-5 text-sm">
            <span>Turn {Math.min(session.turnsCompleted + 1, 6)} of 6</span>
            <span
              role="timer"
              aria-label="Time remaining"
              className="flex items-center gap-2 font-mono text-primary"
            >
              <Clock3 className="size-4" />
              {Math.floor(seconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(seconds % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}
      </header>
      <div
        className={
          !session && !loading && entry && !monitoringDisqualified
            ? "candidate-entry mx-auto grid w-full max-w-5xl items-start gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-8 lg:gap-y-3 lg:py-10"
            : "contents"
        }
      >
        {monitoringConnected && !loading && entry && (
          <CandidateMonitoring
            token={token}
            sessionId={session?.id ?? entry.sessionId ?? undefined}
            recordingConfigured={recordingConfigured}
            onRecordingFinalizer={setRecordingFinalizer}
            onReady={setMonitoringReady}
            onDisqualified={setMonitoringDisqualified}
          />
        )}
        {monitoringDisqualified ? null : (session ||
            entry?.status === "in-progress") &&
          monitoringConnected &&
          !monitoringReady ? (
          <Card className="mx-auto my-6 max-w-3xl p-6" role="status">
            <h2 className="font-semibold">Assessment paused</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tasks are hidden and responses are disabled until monitoring
              checks are restored. Your answer is preserved. The assessment
              deadline continues.
            </p>
          </Card>
        ) : loading ? (
          <div className="page-container py-16">
            <Loading />
          </div>
        ) : !session &&
          entry?.status === "in-progress" &&
          monitoringConnected ? (
          <div className="page-container py-8">
            {error ? <Failure message={error} retry={retry} /> : <Loading />}
          </div>
        ) : !session ? (
          entry ? (
            <CandidateEntry
              title={entry.roleTitle}
              durationMinutes={entry.durationMinutes}
              ready={monitoringReady}
              pending={pending}
              onStart={() => void act("start")}
              error={
                error ? <Failure message={error} retry={retry} /> : undefined
              }
            />
          ) : error === "This record is unavailable." ? (
            <div className="page-container max-w-xl py-16">
              <h1 className="text-2xl font-semibold tracking-tight">
                This invitation link isn’t valid.
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Check that you opened the complete link from your invitation, or
                contact the hiring team for a new one.
              </p>
            </div>
          ) : error ? (
            <div className="page-container py-8">
              <Failure message={error} retry={retry} />
            </div>
          ) : null
        ) : (
          <>
            <nav
              className="candidate-mobile-panels"
              aria-label="Workspace panels"
            >
              {[
                ["chat", "Conversation"],
                ["company", "Company"],
                ["reference", "Reference"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mobilePanel === id}
                  onClick={() => setMobilePanel(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="candidate-workspace-grid">
              <aside
                className="candidate-side-panel"
                aria-label="Company context and activity"
                data-mobile-active={mobilePanel === "company"}
                tabIndex={0}
              >
                <Card className="p-5">
                  <p className="eyebrow text-muted-foreground">
                    Company context
                  </p>
                  <h1 className="mt-4 text-xl font-semibold">
                    {session.companyName}
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {session.companyContext}
                  </p>
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="text-xs text-primary">Your role</p>
                    <p className="mt-2 text-sm">{session.roleTitle}</p>
                    {session.candidateRole.trim() !==
                      session.roleTitle.trim() && (
                      <p className="mt-3 text-xs leading-6 text-muted-foreground">
                        {session.candidateRole}
                      </p>
                    )}
                  </div>
                </Card>
                <Card className="p-5">
                  <h2 className="text-sm font-semibold">Workplace activity</h2>
                  <ul className="mt-4 space-y-4 text-xs leading-6">
                    {session.events.map((event) => (
                      <li key={event.id}>
                        <p>{event.title}</p>
                        <time className="text-muted-foreground">
                          {new Date(event.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                  {!session.events.length && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Updates appear here as work progresses.
                    </p>
                  )}
                </Card>
              </aside>
              <section
                className="candidate-conversation"
                aria-label="Manager tasks"
                data-mobile-active={mobilePanel === "chat"}
              >
                <div className="candidate-conversation-heading flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">
                    Conversation with your manager
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {session.turnsCompleted} of 6 responses submitted
                  </span>
                </div>
                <ol
                  className="candidate-messages"
                  ref={conversation}
                  tabIndex={0}
                  aria-label="Assessment conversation"
                  onScroll={() => {
                    const el = conversation.current;
                    if (el)
                      followConversation.current =
                        el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                  }}
                >
                  {session.messages.map((message) => (
                    <li
                      key={message.id}
                      className={
                        message.role === "candidate"
                          ? "candidate-message"
                          : "manager-message"
                      }
                    >
                      <Card
                        className={
                          "chat-message-content " +
                          (message.role === "candidate"
                            ? "bg-secondary"
                            : "bg-background")
                        }
                      >
                        <p className="eyebrow text-muted-foreground">
                          {message.role === "manager"
                            ? "Your manager"
                            : "Your submitted work"}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                          {message.content}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ol>
                <div className="candidate-composer">
                  {finish ? (
                    <>
                      <h2 className="font-semibold">
                        {seconds === 0
                          ? "Your assessment time has ended."
                          : "You have completed the workplace tasks."}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        No further replies are needed. Submit your completed
                        work for the hiring team’s review.
                      </p>
                      <Button
                        className="mt-5"
                        disabled={pending}
                        onClick={() => void act("complete")}
                      >
                        {pending
                          ? "Submitting your assessment…"
                          : "Finish assessment"}
                      </Button>
                    </>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        followConversation.current = true;
                        void act("respond");
                      }}
                    >
                      <label
                        htmlFor="candidate-response"
                        className="text-sm font-medium"
                      >
                        Your response
                      </label>
                      <Textarea
                        id="candidate-response"
                        className="mt-2 min-h-24 max-h-48 resize-none"
                        placeholder="Explain your approach, calculations, trade-offs, and next steps…"
                        value={answer}
                        maxLength={4000}
                        disabled={pending}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            followConversation.current = true;
                            void act("respond");
                          }
                        }}
                        onChange={(e) => {
                          setAnswer(e.target.value);
                          request.current = null;
                        }}
                      />
                      <p className="mt-2 text-right text-xs text-muted-foreground">
                        {answer.length.toLocaleString()} / 4,000 characters
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {pending
                            ? "Your manager is reviewing your response…"
                            : "Ctrl / ⌘ + Enter to send"}
                        </p>
                        <Button
                          type="submit"
                          disabled={
                            pending || !answer.trim() || !monitoringReady
                          }
                        >
                          {pending ? "Sending…" : "Submit response"}
                        </Button>
                      </div>
                    </form>
                  )}
                  {error && (
                    <div className="mt-5">
                      <Failure message={error} retry={retry} />
                    </div>
                  )}
                </div>
              </section>
              <aside
                className="candidate-side-panel"
                aria-label="Reference information"
                data-mobile-active={mobilePanel === "reference"}
                tabIndex={0}
              >
                <Card className="p-5">
                  <h2 className="font-semibold">Company data</h2>
                  <dl className="mt-4 space-y-4">
                    {Object.entries(session.facts).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex flex-wrap justify-between gap-2 border-b border-border pb-3 text-xs"
                      >
                        <dt className="text-muted-foreground">
                          {humanizeKey(key)}
                        </dt>
                        <dd className="break-words font-mono">
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                {session.revealedInfo
                  .filter(
                    (info, index, all) =>
                      all.findIndex(
                        (other) =>
                          JSON.stringify(other.data) ===
                          JSON.stringify(info.data),
                      ) === index,
                  )
                  .map((info) => (
                    <Card key={info.id} className="bg-secondary p-5">
                      <p className="eyebrow text-muted-foreground">
                        Revealed information
                      </p>
                      <h3 className="mt-3 text-sm font-semibold">
                        {info.title}
                      </h3>
                      <dl className="mt-4 space-y-3">
                        {Object.entries(info.data).map(([key, value]) => (
                          <div key={key} className="text-xs leading-6">
                            <dt
                              className={
                                isInternalKey(key)
                                  ? "sr-only"
                                  : "text-muted-foreground"
                              }
                            >
                              {isInternalKey(key)
                                ? "Finding"
                                : humanizeKey(key)}
                            </dt>
                            <dd>{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  ))}
                <CandidateTools session={session} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
