"use client";
import { Select } from "@/components/ui/input";
import type { Blueprint } from "@/lib/contracts";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function BlueprintView({ blueprint: b }: { blueprint: Blueprint }) {
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Workplace environment</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {b.environment.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Tools: {b.environment.tools.join(" · ")} · Data:{" "}
          {b.environment.dataTypes.join(" · ")}
        </p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        {b.competencies.map((c) => (
          <Card key={c.id} className="p-6">
            <div className="flex justify-between gap-4">
              <h3 className="font-semibold">{c.name}</h3>
              <span className="font-mono text-sm text-primary">
                {Math.round(c.weight * 100)}%
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {c.definition}
            </p>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              {c.indicators.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <details className="mt-5">
              <summary className="cursor-pointer text-xs text-primary">
                Locked rubric levels
              </summary>
              <dl className="mt-4 space-y-3">
                {Object.entries(c.rubric).map(([level, description]) => (
                  <div key={level}>
                    <dt className="text-xs font-semibold">Level {level}</dt>
                    <dd className="mt-1 text-xs leading-6 text-muted-foreground">
                      {description}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <h2 className="font-semibold">Scenario families</h2>
        <div className="mt-5 space-y-5">
          {b.scenarioFamilies.map((f) => (
            <article key={f.id}>
              <h3 className="text-sm font-medium">{f.name}</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {f.archetype}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {f.difficulty.hiddenFactCount} hidden facts ·{" "}
                {f.difficulty.complicationCount} complications ·{" "}
                {f.difficulty.ambiguity} ambiguity
              </p>
              <dl className="mt-3 flex flex-wrap gap-4">
                {Object.entries(f.numericRanges).map(([name, r]) => (
                  <div key={name}>
                    <dt className="text-xs text-muted-foreground">{name}</dt>
                    <dd className="mt-1 font-mono text-xs">
                      {r.min}–{r.max}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Expected evidence & constraints</h2>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {[...b.expectedEvidence, ...b.constraints].map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
const lines = (s: string) => s.split("\n");
export function BlueprintEditor({
  blueprint: b,
  onChange,
  embedded = false,
}: {
  blueprint: Blueprint;
  onChange: (b: Blueprint) => void;
  embedded?: boolean;
}) {
  const Panel = embedded ? "section" : Card;
  const total = b.competencies.reduce((s, c) => s + c.weight, 0);
  const balanced = Math.abs(total - 1) <= 0.000001;
  function competency(
    index: number,
    change: Partial<Blueprint["competencies"][number]>,
  ) {
    onChange({
      ...b,
      competencies: b.competencies.map((c, i) =>
        i === index ? { ...c, ...change } : c,
      ),
    });
  }
  return (
    <div className="space-y-5">
      <div
        className={
          embedded
            ? "border-b border-border pb-4 text-sm"
            : "rounded-xl bg-secondary p-5 text-sm"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Total competency weight:{" "}
            <strong className={balanced ? undefined : "text-warning"}>
              {(total * 100).toFixed(1)}%
            </strong>
            {!balanced && " — weights must add up to 100%."}
            {balanced &&
              !embedded &&
              ". Publishing locks this version’s rubric and weights."}
          </p>
          {!balanced && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onChange({
                  ...b,
                  competencies: b.competencies.map((c) => ({
                    ...c,
                    weight: 1 / b.competencies.length,
                  })),
                })
              }
            >
              Split weights evenly
            </Button>
          )}
        </div>
      </div>
      <Panel
        className={
          embedded ? "space-y-5 border-b border-border pb-6" : "space-y-5 p-6"
        }
      >
        <label className="block text-sm">
          Role title
          <Input
            className="mt-2"
            value={b.roleTitle}
            onChange={(e) => onChange({ ...b, roleTitle: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Seniority
          <Input
            className="mt-2"
            value={b.seniority}
            onChange={(e) => onChange({ ...b, seniority: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Duration in minutes
          <Input
            className="mt-2"
            type="number"
            min={5}
            max={120}
            value={b.durationMinutes}
            onChange={(e) =>
              onChange({ ...b, durationMinutes: Number(e.target.value) })
            }
          />
        </label>
        <label className="block text-sm">
          Role description
          <Textarea
            className="mt-2"
            value={b.description}
            onChange={(e) => onChange({ ...b, description: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Workplace environment
          <Textarea
            className="mt-2"
            value={b.environment.description}
            onChange={(e) =>
              onChange({
                ...b,
                environment: { ...b.environment, description: e.target.value },
              })
            }
          />
        </label>
        {(["tools", "dataTypes"] as const).map((field) => (
          <label key={field} className="block text-sm">
            {field === "tools" ? "Available tools" : "Data types"} (one per
            line)
            <Textarea
              className="mt-2"
              value={b.environment[field].join("\n")}
              onChange={(e) =>
                onChange({
                  ...b,
                  environment: {
                    ...b.environment,
                    [field]: lines(e.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </Panel>
      {b.competencies.map((c, i) => (
        <Panel
          key={c.id}
          className={
            embedded
              ? "grid gap-4 border-b border-border py-6 md:grid-cols-2"
              : "grid gap-4 p-5 md:grid-cols-2 md:p-6"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
            <h3 className="font-semibold">
              Competency {i + 1}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {c.name}
              </span>
            </h3>
            <Button
              size="sm"
              variant="ghost"
              disabled={b.competencies.length <= 4}
              onClick={() =>
                onChange({
                  ...b,
                  competencies: b.competencies.filter((x) => x.id !== c.id),
                  scenarioFamilies: b.scenarioFamilies.map((f) => ({
                    ...f,
                    competencyIds: f.competencyIds.filter((id) => id !== c.id),
                  })),
                })
              }
            >
              Remove competency
            </Button>
          </div>
          <label className="block text-sm">
            Competency {i + 1} name
            <Input
              className="mt-2"
              value={c.name}
              onChange={(e) => competency(i, { name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {c.name || "Competency"} weight (%)
            <Input
              className="mt-2"
              type="number"
              min={1}
              max={100}
              step={0.1}
              value={Number((c.weight * 100).toFixed(3))}
              onChange={(e) =>
                competency(i, { weight: Number(e.target.value) / 100 })
              }
            />
          </label>
          <label className="block text-sm">
            {c.name || "Competency"} definition
            <Textarea
              className="mt-2"
              value={c.definition}
              onChange={(e) => competency(i, { definition: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {c.name || "Competency"} observable indicators (one per line)
            <Textarea
              className="mt-2"
              value={c.indicators.join("\n")}
              onChange={(e) =>
                competency(i, { indicators: lines(e.target.value) })
              }
            />
          </label>
          <details className="border-t border-border pt-2 md:col-span-2">
            <summary className="cursor-pointer text-sm text-primary">
              Edit 1–5 rubric
            </summary>
            <div className="mt-4 space-y-4">
              {(["1", "2", "3", "4", "5"] as const).map((level) => (
                <label key={level} className="block text-sm">
                  {c.name || "Competency"} level {level}
                  <Textarea
                    className="mt-2"
                    value={c.rubric[level]}
                    onChange={(e) =>
                      competency(i, {
                        rubric: { ...c.rubric, [level]: e.target.value },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </details>
        </Panel>
      ))}
      {b.competencies.length < 5 && (
        <Button
          variant="secondary"
          onClick={() =>
            onChange({
              ...b,
              competencies: [
                ...b.competencies,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  definition: "",
                  weight: 0.2,
                  indicators: [],
                  rubric: { "1": "", "2": "", "3": "", "4": "", "5": "" },
                },
              ],
            })
          }
        >
          Add fifth competency
        </Button>
      )}
      {b.scenarioFamilies.map((f, i) => (
        <Panel
          key={f.id}
          className={
            embedded ? "space-y-4 border-b border-border py-6" : "space-y-4 p-6"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Scenario family {i + 1}</h3>
            <Button
              variant="ghost"
              size="sm"
              disabled={b.scenarioFamilies.length <= 2}
              onClick={() =>
                onChange({
                  ...b,
                  scenarioFamilies: b.scenarioFamilies.filter(
                    (x) => x.id !== f.id,
                  ),
                })
              }
            >
              Remove family
            </Button>
          </div>
          {(["name", "archetype"] as const).map((field) => (
            <label key={field} className="block text-sm">
              Family {i + 1} {field}
              <Textarea
                className="mt-2"
                value={f[field]}
                onChange={(e) =>
                  onChange({
                    ...b,
                    scenarioFamilies: b.scenarioFamilies.map((x, j) =>
                      j === i ? { ...x, [field]: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
          ))}
          <fieldset className="space-y-3">
            <legend className="mb-3 text-xs font-medium">
              Family {i + 1} targets
            </legend>
            {b.competencies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={f.competencyIds.includes(c.id)}
                  onChange={(e) =>
                    onChange({
                      ...b,
                      scenarioFamilies: b.scenarioFamilies.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              competencyIds: e.target.checked
                                ? [...x.competencyIds, c.id]
                                : x.competencyIds.filter((id) => id !== c.id),
                            }
                          : x,
                      ),
                    })
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          {!embedded && (
            <p className="text-xs leading-6 text-muted-foreground">
              Difficulty parameters apply equally to every family. Numeric
              ranges may vary.
            </p>
          )}
          {(["hiddenFactCount", "complicationCount"] as const).map((field) => (
            <label key={field} className="block text-sm">
              Shared {field}
              <Input
                className="mt-2"
                type="number"
                min={field === "hiddenFactCount" ? 1 : 0}
                value={f.difficulty[field]}
                onChange={(e) =>
                  onChange({
                    ...b,
                    scenarioFamilies: b.scenarioFamilies.map((x) => ({
                      ...x,
                      difficulty: {
                        ...x.difficulty,
                        [field]: Number(e.target.value),
                      },
                    })),
                  })
                }
              />
            </label>
          ))}
          <label className="block text-sm">
            Shared ambiguity
            <Select
              className="mt-2 block w-full"
              aria-label="Shared ambiguity"
              value={f.difficulty.ambiguity}
              onChange={(e) =>
                onChange({
                  ...b,
                  scenarioFamilies: b.scenarioFamilies.map((x) => ({
                    ...x,
                    difficulty: {
                      ...x.difficulty,
                      ambiguity: e.target
                        .value as typeof f.difficulty.ambiguity,
                    },
                  })),
                })
              }
            >
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </Select>
          </label>
          {Object.entries(f.numericRanges).map(([name, range]) => (
            <div key={name} className="grid grid-cols-2 gap-3">
              {(["min", "max"] as const).map((bound) => (
                <label key={bound} className="text-sm">
                  {f.name} {name} {bound}
                  <Input
                    type="number"
                    className="mt-2"
                    value={range[bound]}
                    onChange={(e) =>
                      onChange({
                        ...b,
                        scenarioFamilies: b.scenarioFamilies.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                numericRanges: {
                                  ...x.numericRanges,
                                  [name]: {
                                    ...range,
                                    [bound]: Number(e.target.value),
                                  },
                                },
                              }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </Panel>
      ))}
      {b.scenarioFamilies.length < 3 && (
        <Button
          variant="secondary"
          onClick={() =>
            onChange({
              ...b,
              scenarioFamilies: [
                ...b.scenarioFamilies,
                {
                  ...structuredClone(b.scenarioFamilies[0]),
                  id: crypto.randomUUID(),
                  name: "",
                  archetype: "",
                },
              ],
            })
          }
        >
          Add third scenario family
        </Button>
      )}
      <Panel
        className={
          embedded ? "space-y-5 border-b border-border pb-6" : "space-y-5 p-6"
        }
      >
        {(["expectedEvidence", "constraints"] as const).map((field) => (
          <label className="block text-sm" key={field}>
            {field === "constraints"
              ? "Scenario constraints"
              : "Expected evidence"}{" "}
            (one per line)
            <Textarea
              className="mt-2"
              value={b[field].join("\n")}
              onChange={(e) =>
                onChange({ ...b, [field]: lines(e.target.value) })
              }
            />
          </label>
        ))}
      </Panel>
    </div>
  );
}
