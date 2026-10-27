"use client";
import { useState } from "react";
import { recordingListEnvelope } from "@/lib/recording/contracts";
import { useResource } from "@/lib/b2b/use-resource";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Failure, Loading } from "./common";
export function RecordingReview({
  assessmentId,
  configured = true,
}: {
  assessmentId: string;
  configured?: boolean;
}) {
  const { data, error, loading, reload } = useResource(
    `/api/assessments/${encodeURIComponent(assessmentId)}/recordings`,
    recordingListEnvelope,
  );
  const [selected, setSelected] = useState("");
  // Without recording configured, only surface previously saved recordings.
  if (!configured && !data?.recordings.length) return null;
  return (
    <Card className="mt-6 p-6">
      <h2 className="text-base font-semibold">Private recordings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Recordings support human review. Interrupted uploads are labeled and may
        contain gaps.
      </p>
      {loading && <Loading label="Loading recording metadata…" />}
      {error && <Failure message={error} retry={reload} />}{" "}
      {data && !data.recordings.length && (
        <p className="mt-4 text-sm text-muted-foreground">
          No recordings have been saved for this assessment.
        </p>
      )}
      {data?.recordings.map((r) => (
        <div
          key={r.id}
          className="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm">
              {r.candidateName} · {r.source}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.status === "recording" ? "Not finalized" : r.status} ·{" "}
              {(r.bytes / 1048576).toFixed(1)} MB · Deletes{" "}
              {new Date(r.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!r.chunks}
            onClick={() => setSelected(r.id)}
          >
            Review video
          </Button>
        </div>
      ))}
      {selected && (
        <div className="mt-5">
          <video
            key={selected}
            controls
            preload="metadata"
            className="w-full max-w-3xl rounded-lg bg-secondary"
            src={`/api/recordings/${encodeURIComponent(selected)}/playback`}
            aria-label="Private assessment recording"
          />
          <Button
            className="mt-2"
            size="sm"
            variant="ghost"
            onClick={() => setSelected("")}
          >
            Close playback
          </Button>
        </div>
      )}
    </Card>
  );
}
