"use client";
import { Select } from "@/components/ui/input";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  reportSchema,
  type Report,
  humanDecisionSchema,
} from "@/lib/contracts";
import { api } from "@/lib/b2b/client";
import { useResource } from "@/lib/b2b/use-resource";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Demo, Failure, Loading, WorkspaceHeading } from "./common";
import { CompetencyRadar } from "./competency-radar";
const envelope = z.object({ report: reportSchema });
export function HRReport({ id }: { id: string }) {
  const [updated, setUpdated] = useState<Report | null>(null);
  const { data, error, loading, reload } = useResource(
    "/api/reports/" + encodeURIComponent(id),
    envelope,
  );
  return (
    <div className="workspace-shell workspace-page page-container py-8 md:py-10">
      {error && <Failure message={error} retry={reload} />}
      {loading && <Loading />}
      {data && (
        <ReportBody
          key={data.report.id}
          report={updated?.id === id ? updated : data.report}
          onSaved={setUpdated}
        />
      )}
    </div>
  );
}
function ReportBody({
  report: r,
  onSaved,
}: {
  report: Report;
  onSaved: (report: Report) => void;
}) {
  const [notes, setNotes] = useState(r.reviewerNotes);
  const [reviewed, setReviewed] = useState(r.reviewed);
  const [decision, setDecision] = useState(r.humanDecision);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [highlight, setHighlight] = useState<{
    messageId: string;
    quote: string;
  } | null>(null);
  const busy = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const result = await api(
        "/api/reports/" + encodeURIComponent(r.id),
        envelope,
        { reviewerNotes: notes, reviewed, humanDecision: decision },
        "PATCH",
      );
      setSaved(true);
      onSaved(result.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review could not be saved.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function quote(messageId: string, text: string) {
    setHighlight({ messageId, quote: text });
    const response = document.getElementById("replay-" + messageId);
    response?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    response?.focus({ preventScroll: true });
  }
  const insightGroups = [
    ["Strengths", r.strengths],
    ["Weaknesses", r.weaknesses],
    ["Reasoning mistakes", r.reasoningMistakes],
    ["Contradictions observed", r.contradictions],
    ["Human follow-up topics", r.followUpTopics],
    [
      "Untested competencies",
      r.untestedCompetencies.map(
        (id) => r.blueprint.competencies.find((c) => c.id === id)?.name || id,
      ),
    ],
  ] as const;
  return (
    <>
      <WorkspaceHeading
        section={"Candidate report / Assessment v" + r.assessmentVersion}
        title={
          <>
            {r.candidateName} <Demo demo={r.demo} />
          </>
        }
        back={{ href: "/enterprise/reports", label: "Back to reports" }}
        description={
          <>
            {r.roleTitle} · Completed · {Math.round(r.durationSeconds / 60)}{" "}
            minutes · {r.reviewed ? "Reviewed" : "Awaiting human review"}
          </>
        }
      />
      <p className="mt-6 rounded-xl bg-secondary p-4 text-sm">
        AI assessment is advisory. Hiring decisions are made by reviewers.
      </p>
      <div className="mt-7 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-7">
          <p className="eyebrow text-muted-foreground">Weighted score</p>
          <p className="mt-5 font-mono text-5xl">
            {r.overallWeightedScore === null
              ? "—"
              : r.overallWeightedScore.toFixed(2)}
            <span className="text-lg text-muted-foreground"> / 5</span>
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            Evidence coverage: {r.coveragePercent.toFixed(0)}%
          </p>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            Weights with insufficient evidence are excluded from the overall
            score. Coverage is the percentage of locked competency weight with
            scored evidence.
          </p>
          <p className="mt-5 text-sm">
            Uncertainty:{" "}
            {r.uncertainty.charAt(0).toUpperCase() + r.uncertainty.slice(1)}
          </p>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Competency profile</h2>
          <CompetencyRadar report={r} />
        </Card>
      </div>
      <section className="mt-8" aria-label="Competency evidence">
        <h2 className="text-xl font-semibold">
          The evidence behind each judgment
        </h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {r.blueprint.competencies.map((c) => {
            const item = r.competencies.find((x) => x.competencyId === c.id)!;
            return (
              <Card key={c.id} className="p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className="text-sm text-primary">
                    {item.score === null
                      ? "Insufficient evidence"
                      : item.score + "/5"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Evidence sufficiency: {item.sufficiency} · Weight{" "}
                  {(c.weight * 100).toFixed(0)}%
                </p>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  {item.rationale}
                </p>
                <div className="mt-4 space-y-3">
                  {item.evidence.map((e, i) => (
                    <button
                      key={i}
                      className="block w-full rounded-xl bg-background p-4 text-left transition-colors hover:bg-muted"
                      onClick={() => quote(e.messageId, e.quote)}
                    >
                      <blockquote className="text-sm leading-7">
                        “{e.quote}”
                      </blockquote>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        {e.note}
                      </p>
                      <span className="mt-3 block text-xs text-primary">
                        Inspect original response
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
      <section
        className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Assessment insights"
      >
        {insightGroups.map(([title, items]) => (
          <Card key={title} className="p-6">
            <h2 className="font-semibold">{title}</h2>
            {items.length ? (
              <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                {items.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                None recorded.
              </p>
            )}
            {title === "Contradictions observed" && (
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                Observations for human review, not proof of cheating.
              </p>
            )}
          </Card>
        ))}
      </section>
      <section className="mt-8 scroll-mt-5" aria-label="Simulation replay">
        <h2 className="text-xl font-semibold">Simulation replay</h2>
        <ol className="mt-5 space-y-4">
          {[...r.messages]
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
            .map((m) => {
              const tags = r.competencies.flatMap((c) =>
                c.evidence.filter((e) => e.messageId === m.id),
              );
              const selected =
                highlight?.messageId === m.id ? highlight.quote : null;
              const at = selected ? m.content.indexOf(selected) : -1;
              return (
                <li
                  key={m.id}
                  id={"replay-" + m.id}
                  tabIndex={-1}
                  className="scroll-mt-5 rounded-xl"
                >
                  <Card
                    className={
                      "p-6 " + (m.role === "candidate" ? "bg-secondary" : "")
                    }
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <p className="eyebrow text-primary">
                        {m.role === "candidate"
                          ? "Candidate answer"
                          : "Manager challenge / follow-up"}{" "}
                        · Turn {m.turn}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">
                      {at >= 0 && selected ? (
                        <>
                          {m.content.slice(0, at)}
                          <mark className="bg-primary/25 text-foreground">
                            {selected}
                          </mark>
                          {m.content.slice(at + selected.length)}
                        </>
                      ) : (
                        m.content
                      )}
                    </p>
                    {!!tags.length && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {tags.map((e, i) => (
                          <span
                            key={i}
                            className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary"
                          >
                            {
                              r.blueprint.competencies.find(
                                (c) => c.id === e.competencyId,
                              )?.name
                            }
                            : {e.note}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
        </ol>
      </section>
      <Card className="mt-8 max-w-3xl p-6">
        <h2 className="text-lg font-semibold">Independent human review</h2>
        <form onSubmit={save} className="mt-5" onChange={() => setSaved(false)}>
          <fieldset disabled={pending} className="space-y-5">
            <legend className="sr-only">Review notes and decision</legend>
            <label htmlFor="reviewer-notes" className="block text-sm">
              Private reviewer notes
              <Textarea
                className="mt-2"
                id="reviewer-notes"
                value={notes}
                maxLength={10000}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              Mark reviewed
            </label>
            <label htmlFor="human-decision" className="block text-sm">
              Human decision
              <Select
                className="mt-2 block w-full"
                id="human-decision"
                aria-label="Human decision"
                value={decision}
                onChange={(e) =>
                  setDecision(humanDecisionSchema.parse(e.target.value))
                }
              >
                <option value="undecided">Undecided</option>
                <option value="advance">Advance to next stage</option>
                <option value="hold">Hold for follow-up</option>
                <option value="decline">Decline (reviewer decision)</option>
              </Select>
            </label>
            <p className="text-xs leading-6 text-muted-foreground">
              This choice is yours. No AI hiring recommendation is provided.
            </p>
            <Button disabled={pending} type="submit">
              {pending ? "Saving review…" : "Save human review"}
            </Button>
          </fieldset>
          {saved && (
            <p role="status" className="text-sm text-primary">
              Human review saved.
            </p>
          )}
          {error && <Failure message={error} />}
        </form>
      </Card>
    </>
  );
}
