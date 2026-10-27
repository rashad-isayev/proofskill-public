"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import { CandidateModal } from "./candidate-modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RecordStatus, Failure } from "./common";
import {
  decisions,
  decisionLabels,
  type Candidate,
  type Assignment,
} from "@/lib/candidates/contracts";

const progressLabels = {
  invited: "Invited",
  "in-progress": "In progress",
  completed: "Completed",
  expired: "Expired",
  closed: "Closed",
};
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function CandidateDetail({
  candidate,
  busy,
  message,
  failure,
  onClose,
  onAssign,
  onDecision,
}: {
  candidate: Candidate;
  busy: boolean;
  message: string;
  failure: string;
  onClose: () => void;
  onAssign: () => void;
  onDecision: (value: Candidate["decision"]) => void;
}) {
  const assignments = candidate.assignments;
  const reportCount = assignments.filter((a) => a.reportId).length;
  return (
    <CandidateModal title={candidate.name} busy={busy} onClose={onClose}>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {candidate.position || "Position not specified"}
          </p>
          <a
            href={`mailto:${candidate.email}`}
            className="mt-1 block break-all text-sm text-muted-foreground hover:text-foreground"
          >
            {candidate.email}
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Added {date(candidate.createdAt)}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-4">
          <label
            htmlFor="candidate-hiring-status"
            className="text-sm font-medium"
          >
            Hiring status
          </label>
          <Select
            id="candidate-hiring-status"
            aria-label="Candidate hiring status"
            className="mt-2 w-full"
            disabled={busy}
            value={candidate.decision}
            onChange={(e) =>
              onDecision(e.target.value as Candidate["decision"])
            }
          >
            {decisions.map((value) => (
              <option key={value} value={value}>
                {decisionLabels[value]}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Applies across all assessments. Changes save automatically.
          </p>
        </div>
      </div>
      <div
        aria-live="polite"
        className={busy || message || failure ? "mt-4" : undefined}
      >
        {busy ? (
          <p role="status" className="text-sm text-muted-foreground">
            Saving hiring status…
          </p>
        ) : (
          message && (
            <p role="status" className="text-sm text-success">
              {message}
            </p>
          )
        )}
        {failure && <Failure message={failure} />}
      </div>
      <section className="mt-7" aria-labelledby="candidate-assignments-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="candidate-assignments-title" className="font-semibold">
              Assessment assignments
            </h3>
            {assignments.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {assignments.length} assigned ·{" "}
                {assignments.filter((a) => a.progress === "completed").length}{" "}
                completed · {reportCount}{" "}
                {reportCount === 1 ? "report" : "reports"} available
              </p>
            )}
          </div>
          <Button variant="secondary" disabled={busy} onClick={onAssign}>
            Assign assessment
          </Button>
        </div>
        {assignments.length === 0 ? (
          <div className="mt-4 rounded-xl bg-secondary/40 px-5 py-8 text-center">
            <ClipboardList
              aria-hidden="true"
              className="mx-auto mb-3 size-6 text-muted-foreground"
            />
            <p className="text-sm font-medium">No assessments assigned yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Assign a published assessment to create this candidate’s private
              invitation.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {assignments.map((assignment) => (
              <AssignmentItem key={assignment.id} assignment={assignment} />
            ))}
          </ul>
        )}
      </section>
    </CandidateModal>
  );
}

function AssignmentItem({ assignment: a }: { assignment: Assignment }) {
  const [showLink, setShowLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const canInvite =
    !!a.invitePath &&
    (a.progress === "invited" || a.progress === "in-progress");
  const url = a.invitePath
    ? typeof window === "undefined"
      ? a.invitePath
      : window.location.origin + a.invitePath
    : "";
  async function copyLink() {
    setCopyError("");
    setCopied(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setShowLink(true);
      setCopyError(
        "Clipboard unavailable. Select and copy the invitation link below.",
      );
    }
  }
  return (
    <li className="min-w-0 rounded-xl bg-secondary/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            className="block break-words font-medium hover:text-primary"
            href={`/enterprise/assessments/${a.assessmentId}`}
          >
            {a.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Version {a.assessmentVersion} · Assigned {date(a.createdAt)}
          </p>
        </div>
        <RecordStatus status={a.progress} label={progressLabels[a.progress]} />
      </div>
      {(a.startedAt || a.completedAt) && (
        <p className="mt-3 text-xs text-muted-foreground">
          {a.completedAt
            ? `Completed ${date(a.completedAt)}`
            : `Started ${date(a.startedAt!)}`}
        </p>
      )}
      {(canInvite || a.reportId) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {a.reportId && (
            <Button asChild size="sm">
              <Link href={`/enterprise/reports/${a.reportId}`}>
                View report
              </Link>
            </Button>
          )}
          {canInvite && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copyLink()}
              >
                {copied ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copied
                  ? "Copied"
                  : a.progress === "in-progress"
                    ? "Copy resume link"
                    : "Copy invite link"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showLink}
                aria-controls={`invitation-${a.id}`}
                onClick={() => setShowLink(!showLink)}
              >
                {showLink ? (
                  <ChevronUp aria-hidden="true" />
                ) : (
                  <ChevronDown aria-hidden="true" />
                )}
                {showLink ? "Hide link" : "Show link"}
              </Button>
            </>
          )}
        </div>
      )}
      <p role="status" className="sr-only">
        {copied ? `Invitation link copied for ${a.title}.` : ""}
      </p>
      {copyError && (
        <p role="alert" className="mt-3 text-sm text-muted-foreground">
          {copyError}
        </p>
      )}
      {canInvite && showLink && (
        <div id={`invitation-${a.id}`} className="mt-3">
          <Input
            aria-label={`Invitation link for ${a.title}`}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
      {!a.invitePath && a.progress === "invited" && (
        <p className="mt-3 text-xs text-muted-foreground">
          This earlier invitation uses its original link.
        </p>
      )}
      {!a.reportId && a.progress === "completed" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Report not available yet. Open the assessment to review this attempt.
        </p>
      )}
    </li>
  );
}
