"use client";
import { Select } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  Plus,
  Upload,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { assessmentSchema, type Assessment } from "@/lib/contracts";
import {
  directorySchema,
  decisions,
  decisionLabels,
  importResultSchema,
  assignResultSchema,
  type Candidate,
} from "@/lib/candidates/contracts";
import { api } from "@/lib/b2b/client";
import { useResource } from "@/lib/b2b/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CandidateModal } from "./candidate-modal";
import { CandidateDetail } from "./candidate-detail";
import { CandidateImport } from "./candidate-import";
import { WorkspaceHeading, RecordStatus, Failure, Loading } from "./common";
const assessmentList = z.object({ assessments: z.array(assessmentSchema) });
const saved = z.object({ saved: z.boolean() });
const progressLabels = {
  "not-assigned": "Not assigned",
  invited: "Invited",
  "in-progress": "In progress",
  completed: "Completed",
  expired: "Expired",
  closed: "Closed",
};
function overallProgress(c: Candidate): keyof typeof progressLabels {
  if (!c.assignments.length) return "not-assigned";
  if (c.assignments.every((a) => a.progress === "closed")) return "closed";
  if (c.assignments.some((a) => a.progress === "in-progress"))
    return "in-progress";
  if (c.assignments.some((a) => a.progress === "invited")) return "invited";
  return c.assignments.every((a) => a.progress === "completed")
    ? "completed"
    : "expired";
}

export function CandidateDirectory({
  initialAssessmentId,
}: {
  initialAssessmentId?: string;
}) {
  const { data, error, loading, reload } = useResource(
    "/api/candidates",
    directorySchema,
  );
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState("all");
  const [progress, setProgress] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<"add" | "import" | "assign" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const candidates = useMemo(() => data?.candidates ?? [], [data]);
  const emails = useMemo(() => candidates.map((c) => c.email), [candidates]);
  // Refresh progress without replacing server-owned session state or resetting filters.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  const filtered = candidates.filter(
    (c) =>
      [c.name, c.email, c.position, ...c.assignments.map((a) => a.title)]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (decision === "all" || c.decision === decision) &&
      (progress === "all" || overallProgress(c) === progress),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 25) - 1),
  );
  const visible = filtered.slice(currentPage * 25, (currentPage + 1) * 25);
  const active = candidates.find((c) => c.id === detail);
  const selection = selected.filter((id) =>
    candidates.some((c) => c.id === id),
  );
  function openDetail(id: string) {
    setMessage("");
    setFailure("");
    setDetail(id);
  }
  function complete(text: string) {
    setModal(null);
    setMessage(text);
    void reload();
  }
  async function update(c: Candidate, value: Candidate["decision"]) {
    if (pending) return;
    setPending(c.id);
    setFailure("");
    try {
      await api(
        "/api/candidates/" + c.id,
        saved,
        { decision: value, revision: c.revision },
        "PATCH",
      );
      setMessage(`Hiring status updated for ${c.name}.`);
      await reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Status could not be saved.");
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="workspace-shell workspace-page page-container">
      <WorkspaceHeading
        title="Candidates"
        section="Hiring workspace"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setModal("import")}
              disabled={!data}
            >
              <Upload aria-hidden="true" />
              Import candidates
            </Button>
            <Button onClick={() => setModal("add")} disabled={!data}>
              <Plus aria-hidden="true" />
              Add candidate
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Candidates", candidates.length],
          [
            "Assessments in progress",
            candidates.filter((c) =>
              c.assignments.some((a) => a.progress === "in-progress"),
            ).length,
          ],
          [
            "Follow-up required",
            candidates.filter((c) => c.decision === "follow-up-required")
              .length,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-secondary/40 p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {data ? value : "—"}
            </p>
          </div>
        ))}
      </div>
      <div className="ui-toolbar">
        <Input
          className="max-w-lg"
          aria-label="Search candidates"
          placeholder="Search name, email, position…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <Select
          aria-label="Filter hiring status"
          value={decision}
          onChange={(e) => {
            setDecision(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All hiring statuses</option>
          {decisions.map((d) => (
            <option key={d} value={d}>
              {decisionLabels[d]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter assessment progress"
          value={progress}
          onChange={(e) => {
            setProgress(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All assessment progress</option>
          {Object.entries(progressLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh candidates"
          disabled={loading}
          onClick={() => void reload()}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "candidate" : "candidates"}
          {selection.length ? ` · ${selection.length} selected` : ""}
        </p>
        <div className="flex gap-2">
          {!!selection.length && (
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear selection
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={!selection.length || selection.length > 100}
            onClick={() => setModal("assign")}
          >
            <ClipboardList aria-hidden="true" />
            Assign assessment{selection.length ? ` (${selection.length})` : ""}
          </Button>
        </div>
      </div>
      {initialAssessmentId && !selection.length && !!data && (
        <p role="note" className="mb-4 rounded-xl bg-secondary p-4 text-sm">
          {candidates.length ? (
            <>
              Select the candidates to invite, then choose{" "}
              <strong className="font-medium">Assign assessment</strong>.
            </>
          ) : (
            <>
              Add or import candidates first, then select them and choose{" "}
              <strong className="font-medium">Assign assessment</strong>.
            </>
          )}{" "}
          The assessment you came from is preselected.
        </p>
      )}
      {selection.length > 100 && (
        <p className="mb-4 text-sm text-warning">
          Assign up to 100 candidates at a time.
        </p>
      )}
      {message && !active && (
        <p role="status" className="my-4 text-sm text-success">
          {message}
        </p>
      )}
      {(error || failure) && (
        <Failure
          message={failure || error}
          retry={() => {
            setFailure("");
            void reload();
          }}
        />
      )}
      {loading && !data && <Loading label="Loading candidates…" />}
      {data && (
        <>
          <div
            className="ui-table-scroll bg-background"
            tabIndex={0}
            role="region"
            aria-label="Candidate table"
          >
            <table className="ui-table min-w-[1050px]">
              <caption className="sr-only">Candidate directory</caption>
              <thead className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="p-4">
                    <input
                      type="checkbox"
                      aria-label="Select candidates on this page"
                      checked={
                        !!visible.length &&
                        visible.every((c) => selection.includes(c.id))
                      }
                      disabled={!visible.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...selection,
                                  ...visible.map((c) => c.id),
                                ]),
                              ]
                            : selection.filter(
                                (id) => !visible.some((c) => c.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                  {[
                    "Candidate",
                    "Position",
                    "Assessments",
                    "Assessment progress",
                    "Hiring status",
                    "Last activity",
                    "Actions",
                  ].map((h) => (
                    <th scope="col" key={h} className="p-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const p = overallProgress(c),
                    last = [
                      c.updatedAt,
                      ...c.assignments.map((a) => a.lastActivity),
                    ]
                      .sort()
                      .at(-1)!;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/30 ${selection.includes(c.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.name}`}
                          checked={selection.includes(c.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selection, c.id]
                                : selection.filter((id) => id !== c.id),
                            )
                          }
                        />
                      </td>
                      <td className="min-w-56 p-4">
                        <button
                          className="text-left font-medium hover:text-primary"
                          onClick={() => openDetail(c.id)}
                        >
                          {c.name}
                        </button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.email}
                        </p>
                      </td>
                      <td className="min-w-40 max-w-48 p-4">
                        {c.position || "—"}
                      </td>
                      <td className="p-4">
                        <button
                          className="text-primary hover:underline"
                          onClick={() => openDetail(c.id)}
                        >
                          {c.assignments.length} assigned
                        </button>
                        {!!c.assignments.length && (
                          <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                            {c.assignments[0].title}
                            {c.assignments.length > 1
                              ? ` +${c.assignments.length - 1}`
                              : ""}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <RecordStatus status={p} label={progressLabels[p]} />
                      </td>
                      <td className="p-4">
                        <RecordStatus
                          status={c.decision}
                          label={decisionLabels[c.decision]}
                        />
                      </td>
                      <td className="whitespace-nowrap p-4 text-xs text-muted-foreground">
                        {new Date(last).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(c.id)}
                        >
                          View candidate
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length && (
              <div className="p-10 text-center">
                <p className="font-medium">
                  {candidates.length
                    ? "No matching candidates."
                    : "No candidates yet."}
                </p>
                <Button
                  variant="ghost"
                  className="mt-3"
                  onClick={() =>
                    candidates.length
                      ? (setSearch(""), setDecision("all"), setProgress("all"))
                      : setModal("add")
                  }
                >
                  {candidates.length ? "Clear filters" : "Add candidate"}
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {currentPage + 1} of{" "}
              {Math.max(1, Math.ceil(filtered.length / 25))}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                disabled={(currentPage + 1) * 25 >= filtered.length}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
      {modal === "add" && (
        <AddCandidate onClose={() => setModal(null)} onSaved={complete} />
      )}
      {modal === "import" && (
        <CandidateImport
          emails={emails}
          onClose={() => setModal(null)}
          onSaved={complete}
        />
      )}
      {modal === "assign" && (
        <AssignAssessment
          candidates={candidates.filter((c) => selection.includes(c.id))}
          onClose={() => setModal(null)}
          onSaved={complete}
          initialAssessmentId={initialAssessmentId}
        />
      )}
      {active && (
        <CandidateDetail
          candidate={active}
          busy={!!pending}
          message={message}
          failure={failure}
          onClose={() => setDetail(null)}
          onDecision={(value) => void update(active, value)}
          onAssign={() => {
            setSelected([active.id]);
            setDetail(null);
            setModal("assign");
          }}
        />
      )}
    </div>
  );
}
function AddCandidate({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/candidates", importResultSchema, {
        name: f.get("name"),
        email: f.get("email"),
        position: f.get("position"),
      });
      onSaved("Candidate added.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Candidate could not be added.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <CandidateModal
      size="sm"
      title="Add candidate"
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          {[
            ["Name", "name", 150],
            ["Email", "email", 254],
            ["Position (optional)", "position", 160],
          ].map(([label, name, max]) => (
            <label key={name} className="block text-sm">
              {label}
              <Input
                className="mt-2"
                name={String(name)}
                type={name === "email" ? "email" : "text"}
                maxLength={Number(max)}
                required={name !== "position"}
              />
            </label>
          ))}
        </fieldset>
        {error && <Failure message={error} />}
        <Button disabled={busy} type="submit">
          {busy ? "Adding…" : "Add candidate"}
        </Button>
      </form>
    </CandidateModal>
  );
}
function AssignAssessment({
  candidates,
  onClose,
  onSaved,
  initialAssessmentId,
}: {
  candidates: Candidate[];
  initialAssessmentId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { data, error, loading, reload } = useResource(
    "/api/assessments",
    assessmentList,
  );
  const [assessmentId, setAssessmentId] = useState(initialAssessmentId ?? "");
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  const available = (data?.assessments ?? []).filter(
    (a) => a.status === "published",
  );
  const assessment = available.find((a) => a.id === assessmentId);
  async function assign(a: Assessment) {
    if (busy) return;
    setBusy(true);
    setFailure("");
    try {
      const body = {
          candidateIds: candidates.map((c) => c.id).sort(),
          assessmentId: a.id,
          assessmentVersion: a.version,
        },
        key = JSON.stringify(body);
      if (request.current?.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const r = await api("/api/candidates/assignments", assignResultSchema, {
        ...body,
        requestId: request.current.id,
      });
      onSaved(
        `${r.created} ${r.created === 1 ? "assessment" : "assessments"} assigned.` +
          (r.skipped
            ? ` ${r.skipped} existing ${r.skipped === 1 ? "assignment" : "assignments"} skipped.`
            : "") +
          " Private links are available in candidate details.",
      );
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <CandidateModal
      size="md"
      title="Assign assessment"
      busy={busy}
      onClose={onClose}
    >
      <p className="mb-5 text-sm">
        {candidates.length}{" "}
        {candidates.length === 1 ? "candidate" : "candidates"} selected
      </p>
      {error && <Failure message={error} retry={() => void reload()} />}
      {failure && <Failure message={failure} />}
      {loading && <Loading />}
      {data && !available.length && (
        <p className="text-sm">
          Publish an assessment before assigning candidates.
        </p>
      )}
      {!!available.length && (
        <>
          <label className="block text-sm">
            Published assessment
            <Select
              className="mt-2 w-full"
              disabled={busy}
              aria-label="Published assessment"
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
            >
              <option value="">Choose assessment</option>
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.blueprint.roleTitle} · v{a.version} ·{" "}
                  {a.blueprint.durationMinutes} min
                </option>
              ))}
            </Select>
          </label>
          <ul className="my-5 max-h-48 overflow-auto text-sm">
            {candidates.map((c) => (
              <li key={c.id} className="border-b border-border py-2">
                {c.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.email}
                </span>
              </li>
            ))}
          </ul>
          <Button
            disabled={busy || !assessment}
            onClick={() => assessment && void assign(assessment)}
          >
            {busy ? "Assigning…" : "Assign and create links"}
          </Button>
        </>
      )}
    </CandidateModal>
  );
}
