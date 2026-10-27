"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { z } from "zod";
import { assessmentDetailSchema, assessmentSchema } from "@/lib/contracts";
import { useResource } from "@/lib/b2b/use-resource";
import { api } from "@/lib/b2b/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BlueprintView } from "./blueprint";
import {
  Demo,
  Failure,
  Loading,
  WorkspaceHeading,
  RecordStatus,
} from "./common";
import { RecordingReview } from "./recording-review";
import { MonitoringSettings } from "./monitoring-settings";
const savedAssessment = z.object({ assessment: assessmentSchema });
export function AssessmentDetail({
  id,
  monitoringConnected = false,
  recordingConfigured = true,
}: {
  id: string;
  monitoringConnected?: boolean;
  recordingConfigured?: boolean;
}) {
  const { data, error, loading, reload } = useResource(
    "/api/assessments/" + encodeURIComponent(id),
    assessmentDetailSchema,
  );
  const [failure, setFailure] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const closeRequest = useRef<string | null>(null);
  async function close() {
    if (!data || pending) return;
    setPending(true);
    setFailure("");
    closeRequest.current ??= crypto.randomUUID();
    try {
      await api("/api/assessments", savedAssessment, {
        blueprint: data.assessment.blueprint,
        status: "closed",
        assessmentId: data.assessment.id,
        baseVersion: data.assessment.version,
        requestId: closeRequest.current,
      });
      closeRequest.current = null;
      setConfirmClose(false);
      await reload();
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "The assessment could not be closed.",
      );
    } finally {
      setPending(false);
    }
  }
  async function evaluate(sessionId: string) {
    setPending(true);
    setFailure("");
    try {
      await api("/api/simulations/evaluate", z.object({ saved: z.boolean() }), {
        sessionId,
      });
      await reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Report failed. Retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="workspace-shell workspace-page page-container py-8 md:py-10">
      {error && <Failure message={error} retry={reload} />}
      {loading && <Loading />}
      {data && (
        <>
          <WorkspaceHeading
            section={"Assessment / Version " + data.assessment.version}
            title={data.assessment.blueprint.roleTitle}
            back={{
              href: "/enterprise/assessments",
              label: "Back to assessments",
            }}
            description={
              <>
                <RecordStatus status={data.assessment.status} /> ·{" "}
                {data.assessment.blueprint.durationMinutes} minutes{" "}
                <Demo demo={data.assessment.demo} />
                {data.assessment.publishedAt &&
                  " · Published " +
                    new Date(data.assessment.publishedAt).toLocaleString()}
              </>
            }
            actions={
              data.assessment.status === "closed" ? undefined : (
                <>
                  {data.assessment.status === "published" &&
                    (confirmClose ? (
                      <>
                        <Button
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setConfirmClose(false)}
                        >
                          Keep open
                        </Button>
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => void close()}
                        >
                          {pending ? "Closing…" : "Confirm close"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setConfirmClose(true)}
                      >
                        Close assessment
                      </Button>
                    ))}
                  <Button asChild variant="secondary">
                    <Link
                      href={
                        "/enterprise/assessments?create=1&from=" +
                        encodeURIComponent(id)
                      }
                    >
                      {data.assessment.status === "published"
                        ? "Create new version"
                        : "Edit draft"}
                    </Link>
                  </Button>
                </>
              )
            }
          />
          {confirmClose && data.assessment.status === "published" && (
            <p role="status" className="text-sm text-muted-foreground">
              Closing stops unstarted invitations from opening. Candidates
              already working can finish, and existing reports stay available.
            </p>
          )}
          {data.assessment.status === "closed" && (
            <p className="text-sm text-muted-foreground">
              This assessment is closed. Unstarted invitations no longer open;
              reports and evidence remain available.
            </p>
          )}
          <MonitoringSettings
            assessmentId={id}
            connected={monitoringConnected}
            editable={data.assessment.status === "draft"}
          />
          {monitoringConnected && (
            <RecordingReview
              assessmentId={id}
              configured={recordingConfigured}
            />
          )}
          <div className="mt-8">
            <BlueprintView blueprint={data.assessment.blueprint} />
          </div>
          {data.assessment.status === "published" && (
            <div className="mt-7 flex justify-end">
              <Button asChild>
                <Link
                  href={
                    "/enterprise/candidates?assessment=" +
                    encodeURIComponent(id)
                  }
                >
                  Assign candidates
                </Link>
              </Button>
            </div>
          )}
          {failure && <Failure message={failure} />}
          <Card className="mt-7 overflow-hidden">
            <h2 className="p-6 text-lg font-semibold">Candidates</h2>
            {!data.invites.length ? (
              <p className="px-6 pb-8 text-sm text-muted-foreground">
                No candidates invited to this assessment yet.
              </p>
            ) : (
              <div
                className="ui-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Assessment candidates"
              >
                <table className="ui-table min-w-[650px]">
                  <thead className="bg-secondary/40 text-xs text-muted-foreground">
                    <tr>
                      {[
                        "Candidate",
                        "Status",
                        "Started",
                        "Duration",
                        "Report",
                      ].map((x) => (
                        <th key={x} scope="col" className="p-4 font-medium">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.invites.map((i) => (
                      <tr key={i.id} className="border-t border-border">
                        <td className="p-4">
                          {i.candidateName} <Demo demo={i.demo} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {i.candidateEmail}
                          </p>
                        </td>
                        <td className="p-4">
                          <RecordStatus status={i.status} />
                        </td>
                        <td className="p-4 text-xs">
                          {i.startedAt
                            ? new Date(i.startedAt).toLocaleString()
                            : "Not started"}
                        </td>
                        <td className="p-4">
                          {i.durationSeconds === null
                            ? "—"
                            : Math.round(i.durationSeconds / 60) + " min"}
                        </td>
                        <td className="p-4">
                          {i.reportId ? (
                            <Link
                              className="text-primary"
                              href={
                                "/enterprise/reports/" +
                                encodeURIComponent(i.reportId)
                              }
                            >
                              Open report
                            </Link>
                          ) : i.status === "archived" && i.sessionId ? (
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => void evaluate(i.sessionId!)}
                            >
                              Generate report
                            </Button>
                          ) : (
                            "Not available"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
