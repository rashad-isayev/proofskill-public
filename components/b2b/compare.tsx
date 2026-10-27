"use client";
import { Select } from "@/components/ui/input";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  assessmentSchema,
  assessmentDetailSchema,
  reportSchema,
  type Assessment,
  type Invite,
  type Report,
} from "@/lib/contracts";
import { api } from "@/lib/b2b/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Demo, Failure, Loading, WorkspaceHeading } from "./common";
const list = z.object({ assessments: z.array(assessmentSchema) });
const reportEnvelope = z.object({ report: reportSchema });
export function CompareCandidates() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [ids, setIds] = useState(["", ""]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function listAssessments() {
    try {
      setAssessments((await api("/api/assessments", list)).assessments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load assessments.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    api("/api/assessments", list)
      .then((d) => {
        if (active) setAssessments(d.assessments);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    api(
      "/api/assessments/" + encodeURIComponent(selected),
      assessmentDetailSchema,
    )
      .then((d) => {
        if (active)
          setInvites(
            d.invites.filter(
              (i) => i.assessmentVersion === d.assessment.version && i.reportId,
            ),
          );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, refresh]);
  async function compare() {
    setLoading(true);
    setError("");
    setReports([]);
    try {
      const fetched = await Promise.all(
        ids.map((id) =>
          api("/api/reports/" + encodeURIComponent(id), reportEnvelope),
        ),
      );
      const rs = fetched.map((d) => d.report);
      if (
        rs[0].assessmentId !== selected ||
        rs[0].assessmentVersion !==
          assessments.find((a) => a.id === selected)?.version ||
        rs[0].assessmentId !== rs[1].assessmentId ||
        rs[0].assessmentVersion !== rs[1].assessmentVersion
      )
        throw new Error(
          "Reports must use the same assessment and locked version.",
        );
      setReports(rs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="workspace-shell workspace-page page-container py-8 md:py-10">
      <WorkspaceHeading
        section="Human review"
        title="Compare candidates"
        back={{ href: "/enterprise/candidates", label: "Back to candidates" }}
        description="Compare evidence side by side within one assessment version. No ranking or hiring recommendation is generated."
      />
      <label
        htmlFor="comparison-assessment"
        className="mt-7 block max-w-2xl text-sm"
      >
        Assessment version
        <Select
          className="mt-2 w-full"
          id="comparison-assessment"
          aria-label="Assessment version"
          disabled={loading}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setInvites([]);
            setIds(["", ""]);
            setReports([]);
            setError("");
            setLoading(!!e.target.value);
          }}
        >
          <option value="">Choose an assessment</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.blueprint.roleTitle} · Version {a.version}
              {a.demo ? " · Demo" : ""}
            </option>
          ))}
        </Select>
      </label>
      <div className="mt-5 grid max-w-2xl gap-4 md:grid-cols-2">
        {[0, 1].map((index) => (
          <label
            key={index}
            htmlFor={"comparison-candidate-" + index}
            className="block text-sm"
          >
            Candidate {index + 1}
            <Select
              className="mt-2 w-full"
              id={"comparison-candidate-" + index}
              aria-label={"Candidate " + (index + 1)}
              disabled={loading || !selected || invites.length < 2}
              value={ids[index]}
              onChange={(e) => {
                setIds((prev) =>
                  prev.map((id, i) => (i === index ? e.target.value : id)),
                );
                setReports([]);
                setError("");
              }}
            >
              <option value="">Choose a completed report</option>
              {invites.map((i) => (
                <option
                  key={i.id}
                  value={i.reportId!}
                  disabled={i.reportId === ids[1 - index]}
                >
                  {i.candidateName}
                  {i.demo ? " · Demo" : ""}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </div>
      <Button
        className="mt-5"
        disabled={loading || !ids.every(Boolean) || ids[0] === ids[1]}
        onClick={compare}
      >
        Compare evidence
      </Button>
      {selected && invites.length < 2 && !loading && !error && (
        <p className="mt-4 text-sm text-muted-foreground">
          Two completed reports on this version are needed for comparison.
        </p>
      )}
      {!selected && !loading && !error && (
        <p className="mt-4 text-sm text-muted-foreground">
          {assessments.length
            ? "Choose an assessment version to see its completed reports."
            : "Create and publish an assessment, then collect two completed reports to compare evidence."}
        </p>
      )}
      {loading && <Loading />}
      {error && (
        <Failure
          message={error}
          retry={() => {
            if (ids.every(Boolean)) void compare();
            else {
              setError("");
              setLoading(true);
              if (selected) setRefresh((v) => v + 1);
              else void listAssessments();
            }
          }}
        />
      )}
      {reports.length === 2 && (
        <section
          className="mt-8 grid gap-5 md:grid-cols-2"
          aria-label="Side by side candidate comparison"
        >
          {reports.map((r) => (
            <Card key={r.id} className="p-6">
              <h2 className="text-xl font-semibold">
                {r.candidateName} <Demo demo={r.demo} />
              </h2>
              <p className="mt-3 text-xs text-muted-foreground">
                Evidence coverage {r.coveragePercent.toFixed(0)}%
              </p>
              <div className="mt-6 space-y-6 divide-y divide-border [&>article]:pt-5">
                {r.blueprint.competencies.map((c) => {
                  const item = r.competencies.find(
                    (e) => e.competencyId === c.id,
                  )!;
                  return (
                    <article key={c.id}>
                      <h3 className="text-sm font-semibold">
                        {c.name}{" "}
                        <span className="text-primary">
                          {item.score === null
                            ? "Insufficient evidence"
                            : item.score + "/5"}
                        </span>
                      </h3>
                      <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        {item.rationale}
                      </p>
                      {item.evidence.map((e, i) => (
                        <blockquote
                          key={i}
                          className="mt-3 rounded-lg bg-background p-3 text-xs leading-6"
                        >
                          “{e.quote}”
                        </blockquote>
                      ))}
                    </article>
                  );
                })}
              </div>
              <Button asChild variant="secondary" className="mt-6">
                <Link href={"/enterprise/reports/" + encodeURIComponent(r.id)}>
                  Inspect full report
                </Link>
              </Button>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
