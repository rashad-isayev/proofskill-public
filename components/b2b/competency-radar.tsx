"use client";
import type { Report } from "@/lib/contracts";
export function CompetencyRadar({ report }: { report: Report }) {
  const items = report.blueprint.competencies.map((c) => ({
    name: c.name,
    score:
      report.competencies.find((x) => x.competencyId === c.id)?.score ?? null,
  }));
  const xy = (i: number, r: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
    return { x: 180 + Math.cos(angle) * r, y: 165 + Math.sin(angle) * r };
  };
  const points = items.map((c, i) =>
    c.score === null ? null : xy(i, (c.score / 5) * 95),
  );
  return (
    <div>
      <svg
        viewBox="0 0 360 330"
        className="mx-auto w-full max-w-md"
        role="img"
        aria-label="Competency radar. Missing evidence appears as gaps, never zero."
      >
        {[1, 2, 3, 4, 5].map((level) => (
          <polygon
            key={level}
            points={items
              .map((_, i) => {
                const p = xy(i, (level / 5) * 95);
                return p.x + "," + p.y;
              })
              .join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.7}
          />
        ))}
        {items.map((c, i) => {
          const p = xy(i, 95);
          const label = xy(i, 135);
          return (
            <g key={c.name}>
              <line
                x1={180}
                y1={165}
                x2={p.x}
                y2={p.y}
                stroke="var(--border)"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {c.name.length > 25 ? c.name.slice(0, 23) + "…" : c.name}
              </text>
            </g>
          );
        })}
        {points.every(Boolean) && (
          <polygon
            points={points.map((p) => p!.x + "," + p!.y).join(" ")}
            fill="color-mix(in srgb, var(--primary) 15%, transparent)"
            stroke="none"
          />
        )}
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length];
          return (
            p && (
              <g key={i}>
                {next && (
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={next.x}
                    y2={next.y}
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={4} fill="var(--primary)" />
              </g>
            )
          );
        })}
      </svg>
      <p className="text-center text-xs leading-6 text-muted-foreground">
        Scale 1–5. Gaps indicate insufficient evidence.
      </p>
      <dl className="mt-5 grid gap-3">
        {items.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 text-xs"
          >
            <dt className="text-muted-foreground">{c.name}</dt>
            <dd className="shrink-0 font-mono text-primary">
              {c.score === null ? "Insufficient evidence" : c.score + "/5"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
