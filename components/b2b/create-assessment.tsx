"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  blueprintSchema,
  assessmentSchema,
  assessmentDetailSchema,
  type Blueprint,
  type Assessment,
} from "@/lib/contracts";
import { api } from "@/lib/b2b/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { BlueprintEditor } from "./blueprint";
import { Failure, Loading, WorkspaceHeading } from "./common";
const generated = z.object({ blueprint: blueprintSchema });
const saved = z.object({ assessment: assessmentSchema });
export function CreateAssessment({
  from,
  embedded = false,
  onSaved,
  onBusyChange,
}: {
  from?: string;
  embedded?: boolean;
  onSaved?: (assessment: Assessment) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const content = useRef<HTMLDivElement>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [source, setSource] = useState<{
    id: string;
    version: number;
    status: string;
  } | null>(null);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [monitoring, setMonitoring] = useState<{
    version?: number;
    enabled: boolean;
    restrictClipboard: boolean;
  }>({ enabled: true, restrictClipboard: true });
  const [lastInput, setLastInput] = useState<unknown>(null);
  const busy = useRef(false);
  const saveRequest = useRef<{ key: string; requestId: string } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(!!from);
  const [sourceRefresh, setSourceRefresh] = useState(0);
  useEffect(() => {
    onBusyChange?.(!!pending);
  }, [pending, onBusyChange]);
  useEffect(() => {
    if (embedded) content.current?.closest("dialog")?.scrollTo({ top: 0 });
  }, [embedded, pending, error]);
  useEffect(() => {
    if (!from) return;
    let active = true;
    api("/api/assessments/" + encodeURIComponent(from), assessmentDetailSchema)
      .then((d) => {
        if (active) {
          setBlueprint(d.assessment.blueprint);
          setMonitoring(
            d.assessment.monitoring
              ? {
                  version: d.assessment.monitoring.version,
                  enabled: d.assessment.monitoring.enabled,
                  restrictClipboard: d.assessment.monitoring.restrictClipboard,
                }
              : { enabled: false, restrictClipboard: false },
          );
          setSource({
            id: d.assessment.id,
            version: d.assessment.version,
            status: d.assessment.status,
          });
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setSourceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, sourceRefresh]);
  async function generate(input: unknown) {
    if (busy.current) return;
    busy.current = true;
    setLastInput(input);
    setPending("Generating workplace blueprint…");
    setError("");
    try {
      const data = await api("/api/assessments/generate", generated, input);
      setBlueprint(data.blueprint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      busy.current = false;
      setPending("");
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const competencies = String(f.get("competencies") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (competencies.length > 10 || competencies.some((s) => s.length > 200)) {
      setError(
        "Use up to 10 competencies, with no more than 200 characters per line.",
      );
      return;
    }
    const context = [
      ["Workplace and industry", "workplace"],
      ["Team and collaboration", "team"],
      ["Typical tasks and decisions", "tasks"],
      ["Tools and available data", "tools"],
      ["Expected outcomes and evidence", "outcomes"],
      ["Constraints and challenges", "constraints"],
      ["Additional assessment instructions", "instructions"],
    ].flatMap(([label, name]) => {
      const value = String(f.get(name) || "").trim();
      return value ? [`${label}:\n${value}`] : [];
    });
    const jobDescription = [
      String(f.get("description") || "").trim(),
      ...context,
    ].join("\n\n");
    if (jobDescription.length > 10000) {
      setError(
        "Shorten the role description and customization details to 10,000 characters in total.",
      );
      return;
    }
    void generate({
      jobTitle: String(f.get("jobTitle") || "").trim(),
      seniority: String(f.get("seniority") || "").trim(),
      jobDescription,
      durationMinutes: Number(f.get("duration")),
      competencies,
    });
  }

  async function save(status: "draft" | "published") {
    if (!blueprint || busy.current) return;
    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
    const normalized = {
      ...blueprint,
      environment: {
        ...blueprint.environment,
        tools: clean(blueprint.environment.tools),
        dataTypes: clean(blueprint.environment.dataTypes),
      },
      competencies: blueprint.competencies.map((c) => ({
        ...c,
        indicators: clean(c.indicators),
      })),
      expectedEvidence: clean(blueprint.expectedEvidence),
      constraints: clean(blueprint.constraints),
    };
    const parsed = blueprintSchema.safeParse(normalized);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    busy.current = true;
    setPending(
      status === "published"
        ? "Publishing and locking this version…"
        : "Saving draft…",
    );
    setError("");
    try {
      const body = {
        blueprint: parsed.data,
        // Clipboard restrictions only apply to monitored assessments.
        monitoring: {
          ...monitoring,
          restrictClipboard: monitoring.enabled && monitoring.restrictClipboard,
        },
        status,
        ...(source
          ? { assessmentId: source.id, baseVersion: source.version }
          : {}),
      };
      const key = JSON.stringify(body);
      if (saveRequest.current?.key !== key)
        saveRequest.current = { key, requestId: crypto.randomUUID() };
      const data = await api("/api/assessments", saved, {
        ...body,
        requestId: saveRequest.current.requestId,
      });
      if (onSaved) onSaved(data.assessment);
      else
        router.push(
          "/enterprise/assessments/" + encodeURIComponent(data.assessment.id),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save blueprint.");
    } finally {
      busy.current = false;
      setPending("");
    }
  }
  return (
    <div
      ref={content}
      className={
        embedded
          ? "workspace-page ui-dialog-body"
          : "workspace-shell workspace-page page-container py-8 md:py-10"
      }
    >
      {!embedded ? (
        <WorkspaceHeading
          section="Assessments"
          title={blueprint ? "Review the blueprint." : "Create assessment"}
          back={{
            href: from
              ? "/enterprise/assessments/" + encodeURIComponent(from)
              : "/enterprise/assessments",
            label: from ? "Back to assessment" : "Back to assessments",
          }}
        />
      ) : blueprint ? (
        <h3 className="mb-6 text-xl font-semibold tracking-tight">
          Review the blueprint.
        </h3>
      ) : null}
      {error && (
        <Failure
          message={error}
          retry={
            !blueprint && lastInput
              ? () => generate(lastInput)
              : from && !blueprint
                ? () => {
                    setError("");
                    setSourceLoading(true);
                    setSourceRefresh((value) => value + 1);
                  }
                : undefined
          }
        />
      )}
      {sourceLoading && <Loading label="Loading the assessment version…" />}
      {pending && <Loading label={pending} />}
      {!from && (
        <form hidden={!!blueprint} onSubmit={submit} className="space-y-7">
          <fieldset disabled={!!pending} className="grid gap-5 sm:grid-cols-2">
            <legend className="mb-5 text-base font-semibold">
              Role and assessment length
            </legend>
            <label className="block text-sm sm:col-span-2">
              Job title
              <Input
                className="mt-2"
                name="jobTitle"
                required
                minLength={3}
                maxLength={150}
                placeholder="Junior Digital Marketing Specialist"
              />
            </label>
            <label className="block text-sm">
              Seniority
              <Input
                className="mt-2"
                name="seniority"
                minLength={2}
                required
                maxLength={100}
                placeholder="Junior"
              />
            </label>
            <label className="block text-sm">
              Simulation duration (minutes)
              <Input
                className="mt-2"
                name="duration"
                type="number"
                min={5}
                max={120}
                defaultValue={15}
                required
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              Job description
              <Textarea
                className="mt-2"
                name="description"
                required
                minLength={40}
                maxLength={4000}
              />
            </label>
          </fieldset>
          <fieldset disabled={!!pending} className="space-y-5">
            <legend className="mb-2 text-base font-semibold">
              Shape the workplace
            </legend>
            {[
              ["Workplace and industry", "workplace", 500],
              ["Team and collaboration", "team", 750],
              ["Typical tasks and decisions", "tasks", 1000],
              ["Tools and available data", "tools", 750],
              ["Expected outcomes and evidence", "outcomes", 1000],
              ["Constraints and challenges", "constraints", 750],
              ["Additional assessment instructions", "instructions", 750],
            ].map(([label, name, limit]) => (
              <label key={name} className="block text-sm">
                {label}{" "}
                <span className="text-muted-foreground">(optional)</span>
                <Textarea
                  className="mt-2 min-h-24"
                  name={String(name)}
                  maxLength={Number(limit)}
                />
              </label>
            ))}
            <label className="block text-sm">
              Optional competencies (one per line)
              <Textarea
                className="mt-2 min-h-24"
                name="competencies"
                maxLength={2000}
              />
            </label>
          </fieldset>
          <Button type="submit" disabled={!!pending}>
            Generate AI blueprint
          </Button>
        </form>
      )}
      {blueprint && (
        <div>
          {!from && (
            <Button
              variant="secondary"
              className="mb-5"
              disabled={!!pending}
              onClick={() => setBlueprint(null)}
            >
              Edit role details
            </Button>
          )}
          <fieldset disabled={!!pending}>
            <fieldset
              disabled={!!pending}
              className="mb-6 space-y-3 border-b border-border pb-6"
            >
              <legend className="mb-3 text-sm font-semibold">
                Assessment safeguards
              </legend>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={monitoring.enabled}
                  onChange={(e) =>
                    setMonitoring((p) => ({ ...p, enabled: e.target.checked }))
                  }
                />
                Require camera, entire-screen sharing, and fullscreen
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={monitoring.enabled && monitoring.restrictClipboard}
                  disabled={!monitoring.enabled}
                  onChange={(e) =>
                    setMonitoring((p) => ({
                      ...p,
                      restrictClipboard: e.target.checked,
                    }))
                  }
                />
                Restrict clipboard actions during the assessment
              </label>
              <p className="text-xs text-muted-foreground">
                Three fullscreen exits close the attempt. Consent and activity
                signals are stored for human review; video is stored only when
                private recording is configured for this workspace. Requirements
                lock when published.
              </p>
            </fieldset>
            <BlueprintEditor
              blueprint={blueprint}
              onChange={setBlueprint}
              embedded={embedded}
            />
            <div className="sticky bottom-0 mt-7 flex flex-wrap justify-end gap-3 border-t border-border bg-background py-4">
              <Button variant="secondary" onClick={() => save("draft")}>
                Save as draft
              </Button>
              <Button onClick={() => save("published")}>
                {source?.status === "published"
                  ? "Publish new version"
                  : "Publish assessment"}
              </Button>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
