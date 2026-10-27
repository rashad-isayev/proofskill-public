"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { monitoringEnvelope } from "@/lib/b2b/monitoring-contract";
import { api } from "@/lib/b2b/client";
import { useResource } from "@/lib/b2b/use-resource";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Failure, Loading } from "./common";
export function MonitoringSettings({
  assessmentId,
  connected,
  editable = true,
}: {
  assessmentId: string;
  connected: boolean;
  editable?: boolean;
}) {
  return (
    <Card className="mt-7 p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Assessment monitoring
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Choose whether candidates must consent to camera checks and stay in
        fullscreen. Browser activity signals support human review; they do not
        prove cheating or lock other applications.
      </p>
      {connected ? (
        <ConnectedSettings id={assessmentId} editable={editable} />
      ) : (
        <p className="mt-4 rounded-lg border border-border bg-secondary p-3 text-xs leading-6">
          Monitoring settings are unavailable in this environment. Assessments
          run without monitoring requirements.
        </p>
      )}
    </Card>
  );
}
function ConnectedSettings({
  id,
  editable,
}: {
  id: string;
  editable: boolean;
}) {
  const path = "/api/assessments/" + encodeURIComponent(id) + "/monitoring";
  const { data, error, loading, reload } = useResource(
    path,
    monitoringEnvelope,
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <>
      {loading && <Loading label="Loading monitoring policy…" />}
      {error && <Failure message={error} retry={reload} />}
      {data && (
        <form
          key={JSON.stringify(data.policy)}
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setPending(true);
            setSaved(false);
            setFailure("");
            try {
              await api(
                path,
                monitoringEnvelope,
                {
                  version: data.policy.version,
                  enabled: form.has("enabled"),
                  restrictClipboard: form.has("clipboard"),
                },
                "PUT",
              );
              await reload();
              setSaved(true);
            } catch (error) {
              setFailure(
                error instanceof Error
                  ? error.message
                  : "Policy could not be saved.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {editable ? (
            <fieldset disabled={pending} className="space-y-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={data.policy.enabled}
                  className="mt-1"
                />
                Require camera, entire-screen capture, and fullscreen
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="clipboard"
                  defaultChecked={data.policy.restrictClipboard}
                  className="mt-1"
                />
                Restrict copying, cutting, and pasting within the assessment
              </label>
              <p className="text-xs leading-6 text-muted-foreground">
                Three fullscreen exits close the assessment. Requirements must
                be disclosed before the timer starts. Provide an alternative
                assessment process when a candidate cannot use monitoring.
                Published policies must remain locked for existing invitations.
              </p>
              <Button size="sm" type="submit">
                {pending ? "Saving…" : "Save monitoring policy"}
              </Button>
            </fieldset>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Monitoring: </span>
                {data.policy.enabled
                  ? "Required — camera, entire-screen capture and fullscreen" +
                    (data.policy.restrictClipboard
                      ? "; clipboard restricted"
                      : "")
                  : "Off"}
              </p>
              <p className="text-xs text-muted-foreground">
                Requirements are locked for this version. Create a new version
                to change them.
              </p>
            </div>
          )}
          {data.policy.enabled && !!data.attempts?.length && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="mb-3 text-left font-medium">
                  Monitoring activity
                </caption>
                <thead>
                  <tr>
                    <th className="p-2">Candidate</th>
                    <th className="p-2">Warnings</th>
                    <th className="p-2">Activity signals</th>
                    <th className="p-2">Attempt status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts.map((a) => (
                    <tr key={a.invite_id}>
                      <td className="p-2">{a.candidate_name}</td>
                      <td className="p-2">{a.warnings ?? 0} / 3</td>
                      <td className="p-2">{a.activity_count}</td>
                      <td className="p-2">
                        {a.disqualified
                          ? "Closed — human review available"
                          : "No monitoring termination"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {failure && <Failure message={failure} />}
          {saved && (
            <p role="status" className="text-xs">
              Monitoring policy saved.
            </p>
          )}
        </form>
      )}
    </>
  );
}
