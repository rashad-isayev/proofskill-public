"use client";
import { Select } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  assessmentSchema,
  assessmentDetailSchema,
  type Assessment,
  type Invite,
} from "@/lib/contracts";
import { api } from "@/lib/b2b/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Demo,
  Failure,
  Loading,
  WorkspaceHeading,
  RecordStatus,
} from "./common";
import { AssessmentCreationDialog } from "./assessment-creation-dialog";
const list = z.object({ assessments: z.array(assessmentSchema) });
export function HRCatalog({
  mode,
  initialCreate = false,
  from,
}: {
  mode: "assessments" | "candidates" | "reports";
  initialCreate?: boolean;
  from?: string;
}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [refresh, setRefresh] = useState(0);
  const [creating, setCreating] = useState(initialCreate);
  const [hasOpened, setHasOpened] = useState(initialCreate);
  const [creationKey, setCreationKey] = useState(0);
  const [savedAssessment, setSavedAssessment] = useState<Assessment | null>(
    null,
  );
  // Drop ?create/&from once the dialog closes so a refresh doesn't reopen it.
  function clearCreateQuery() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("create") && !url.searchParams.has("from"))
      return;
    url.searchParams.delete("create");
    url.searchParams.delete("from");
    window.history.replaceState(window.history.state, "", url);
  }
  useEffect(() => {
    let active = true;
    async function fetchRecords() {
      const d = await api("/api/assessments", list);
      const details =
        mode === "assessments"
          ? []
          : await Promise.all(
              d.assessments.map((a) =>
                api(
                  "/api/assessments/" + encodeURIComponent(a.id),
                  assessmentDetailSchema,
                ),
              ),
            );
      return {
        assessments: d.assessments,
        invites: details.flatMap((d) => d.invites),
      };
    }
    fetchRecords()
      .then((d) => {
        if (active) {
          setAssessments(d.assessments);
          setInvites(d.invites);
        }
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
  }, [mode, refresh]);
  function load() {
    setLoading(true);
    setError("");
    setRefresh((v) => v + 1);
  }
  const hasFilters = search.trim() !== "" || status !== "all";
  const candidates = invites.filter(
    (i) =>
      (mode !== "reports" || i.reportId) &&
      [
        i.candidateName,
        i.candidateEmail,
        assessments.find((a) => a.id === i.assessmentId)?.blueprint.roleTitle ||
          "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (status === "all" || i.status === status),
  );
  const filtered = assessments.filter(
    (a) =>
      a.blueprint.roleTitle
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (status === "all" || a.status === status),
  );
  return (
    <div className="workspace-shell workspace-page page-container py-8 md:py-10">
      <WorkspaceHeading
        section="Hiring workspace"
        title={
          mode === "assessments"
            ? "Assessments"
            : mode === "candidates"
              ? "Candidates"
              : "Reports"
        }
        actions={
          mode === "assessments" ? (
            <Button
              onClick={() => {
                setHasOpened(true);
                setCreating(true);
              }}
            >
              Create AI Assessment
            </Button>
          ) : (
            <Button asChild>
              <Link href="/enterprise/compare">Compare candidates</Link>
            </Button>
          )
        }
      />
      {hasOpened && (
        <AssessmentCreationDialog
          key={creationKey}
          open={creating}
          from={savedAssessment ? undefined : from}
          onClose={() => {
            setCreating(false);
            clearCreateQuery();
          }}
          onSaved={(assessment) => {
            clearCreateQuery();
            setSavedAssessment(assessment);
            setCreating(false);
            setHasOpened(false);
            setCreationKey((value) => value + 1);
            load();
          }}
        />
      )}
      {savedAssessment && (
        <div
          role="status"
          className="mt-6 rounded-xl bg-primary/10 p-4 text-sm"
        >
          Assessment{" "}
          {savedAssessment.status === "published"
            ? "published"
            : "saved as draft"}
          .{" "}
          <Link
            className="font-medium text-primary hover:underline"
            href={
              "/enterprise/assessments/" +
              encodeURIComponent(savedAssessment.id)
            }
          >
            Open assessment
          </Link>
        </div>
      )}
      <div className="ui-toolbar">
        <Input
          aria-label="Search hiring records"
          className="max-w-lg"
          placeholder={
            mode === "assessments"
              ? "Search assessments…"
              : "Search candidates or roles…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label="Filter status"
          className=""
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {(mode === "assessments"
            ? ["draft", "published", "closed"]
            : mode === "reports"
              ? ["completed", "reviewed"]
              : ["invited", "in-progress", "completed", "reviewed", "archived"]
          ).map((s) => (
            <option key={s} value={s}>
              {s === "completed" && mode === "reports"
                ? "Awaiting review"
                : (s.charAt(0).toUpperCase() + s.slice(1)).replaceAll("-", " ")}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <Failure
          message={error}
          retry={() => {
            setLoading(true);
            setError("");
            void load();
          }}
        />
      )}
      {loading && <Loading />}
      {!loading &&
        !error &&
        !(mode === "assessments" ? filtered.length : candidates.length) && (
          <Card className="mt-6 p-8">
            <h2 className="font-semibold">
              {hasFilters ? `No matching ${mode}.` : `No ${mode} yet.`}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {hasFilters
                ? "Try a different search or clear your filters."
                : mode === "reports"
                  ? "Reports appear after candidates finish their assessments."
                  : "Create an assessment, review its blueprint and publish it when ready."}
            </p>
            {hasFilters && (
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </Card>
        )}
      {!loading &&
        !error &&
        !!(mode === "assessments" ? filtered.length : candidates.length) && (
          <p aria-live="polite" className="mt-5 text-sm text-muted-foreground">
            {mode === "assessments" ? filtered.length : candidates.length}{" "}
            {(mode === "assessments" ? filtered.length : candidates.length) ===
            1
              ? mode.slice(0, -1)
              : mode}
          </p>
        )}
      {!loading && !error && (
        <div className="mt-6 grid gap-4">
          {mode === "assessments"
            ? filtered.map((a) => (
                <Card
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">
                      {a.blueprint.roleTitle} <Demo demo={a.demo} />
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Version {a.version} · <RecordStatus status={a.status} /> ·{" "}
                      {a.blueprint.durationMinutes} min
                    </p>
                  </div>
                  <Button asChild variant="secondary">
                    <Link
                      href={
                        "/enterprise/assessments/" + encodeURIComponent(a.id)
                      }
                    >
                      Open assessment
                    </Link>
                  </Button>
                </Card>
              ))
            : candidates.map((i) => (
                <Card
                  key={i.id}
                  className="flex flex-wrap justify-between gap-5 p-6"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">
                      {i.candidateName} <Demo demo={i.demo} />
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {
                        assessments.find((a) => a.id === i.assessmentId)
                          ?.blueprint.roleTitle
                      }{" "}
                      · v{i.assessmentVersion}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <RecordStatus
                        status={i.status}
                        label={
                          mode === "reports" && i.status === "completed"
                            ? "Awaiting review"
                            : undefined
                        }
                      />{" "}
                      ·{" "}
                      {i.durationSeconds === null
                        ? "Duration unavailable"
                        : Math.round(i.durationSeconds / 60) + " min"}
                    </p>
                  </div>
                  <Button asChild variant="secondary">
                    <Link
                      href={
                        i.reportId
                          ? "/enterprise/reports/" +
                            encodeURIComponent(i.reportId)
                          : "/enterprise/assessments/" +
                            encodeURIComponent(i.assessmentId)
                      }
                    >
                      {i.reportId ? "Review report" : "View assessment"}
                    </Link>
                  </Button>
                </Card>
              ))}
        </div>
      )}
    </div>
  );
}
