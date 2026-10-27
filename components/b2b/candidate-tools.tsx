"use client";

import { useState } from "react";
import { Calculator, FileText, Table2 } from "lucide-react";
import type { CandidateView } from "@/lib/contracts";
import { calculate, dataCsv, type DataRow } from "@/lib/b2b/calculator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { humanizeKey } from "@/lib/utils";

export function CandidateTools({ session }: { session: CandidateView }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const doc = session.documents.find(
    (item) => "resource:" + item.id === selected,
  );
  const rows: DataRow[] = [
    ...Object.entries(session.facts).map(([field, value]) => ({
      source: "Company data",
      field,
      value,
    })),
    ...session.revealedInfo.flatMap((info) =>
      Object.entries(info.data).map(([field, value]) => ({
        source: info.title,
        field,
        value,
      })),
    ),
  ];
  const filtered = rows.filter((row) =>
    `${row.source} ${row.field} ${humanizeKey(row.field)} ${row.value}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob([dataCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "assessment-data.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function open(id: string) {
    setQuery("");
    setSelected(id);
  }
  return (
    <>
      <Card className="p-5">
        <h2 className="font-semibold">Workplace tools</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Explore available information and check your calculations.
        </p>
        <div className="mt-4 flex flex-col items-start gap-3">
          <Button
            variant="secondary"
            className="max-w-full"
            onClick={() => open("data")}
          >
            <Table2 aria-hidden="true" />
            Open data explorer
          </Button>
          <Button variant="secondary" onClick={() => open("calculator")}>
            <Calculator aria-hidden="true" />
            Open calculator
          </Button>
        </div>
      </Card>
      {session.documents.map((item) => (
        <Card key={item.id} className="p-5">
          <h3 className="flex items-start gap-2 break-words text-sm font-semibold">
            <FileText
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {item.title}
          </h3>
          <Button
            className="mt-4"
            variant="secondary"
            size="sm"
            aria-label={`Open ${item.title}`}
            onClick={() => open("resource:" + item.id)}
          >
            Open resource
          </Button>
        </Card>
      ))}
      {selected !== null && (
        <Dialog
          title={
            doc?.title ??
            (selected === "calculator" ? "Calculator" : "Data explorer")
          }
          size={selected === "calculator" ? "sm" : "lg"}
          onClose={() => setSelected(null)}
        >
          {selected === "calculator" ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  setResult(String(calculate(expression)));
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Check your calculation.",
                  );
                  setResult("");
                }
              }}
            >
              <div>
                <label
                  htmlFor="tool-calculation"
                  className="text-sm font-medium"
                >
                  Calculation
                </label>
                <Input
                  id="tool-calculation"
                  className="mt-2 font-mono"
                  value={expression}
                  maxLength={300}
                  placeholder="(40 / 1000) * 100"
                  aria-describedby="calculation-help"
                  aria-invalid={!!error}
                  onChange={(e) => {
                    setExpression(e.target.value);
                    setResult("");
                    setError("");
                  }}
                />
                <p
                  id="calculation-help"
                  className="mt-2 text-xs leading-6 text-muted-foreground"
                >
                  Use +, -, *, / and parentheses. 20% means 0.2. For a rate,
                  divide the part by the total and multiply by 100.
                </p>
              </div>
              <Button type="submit" disabled={!expression.trim()}>
                Calculate
              </Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <output
                aria-label="Calculation result"
                aria-live="polite"
                className="block break-words rounded-xl bg-secondary p-5 font-mono text-lg"
              >
                {result || "Result appears here"}
              </output>
              <p className="text-xs leading-6 text-muted-foreground">
                Include calculations you want reviewed in your response. Tool
                activity does not submit work.
              </p>
            </form>
          ) : (
            <div className="space-y-6">
              {doc && doc.content !== "Available workplace tool" && (
                <p className="whitespace-pre-wrap break-words text-sm leading-7">
                  {doc.content}
                </p>
              )}
              <p className="text-xs leading-6 text-muted-foreground">
                This workspace uses the information shared in your assessment.
                Newly revealed data appears here as you work.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="tool-data-search"
                    className="text-sm font-medium"
                  >
                    Search available data
                  </label>
                  <Input
                    id="tool-data-search"
                    className="mt-2"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by source, field or value"
                  />
                </div>
                <Button
                  variant="secondary"
                  disabled={!filtered.length}
                  onClick={download}
                >
                  Export CSV
                </Button>
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {filtered.length} of {rows.length} fields
              </p>
              {filtered.length ? (
                <div
                  role="region"
                  aria-label="Available assessment data"
                  tabIndex={0}
                  className="overflow-x-auto"
                >
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="p-3 font-medium">Source</th>
                        <th className="p-3 font-medium">Field</th>
                        <th className="p-3 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="max-w-64 break-words p-3 text-muted-foreground">
                            {row.source}
                          </td>
                          <th
                            scope="row"
                            className="max-w-64 break-words p-3 font-normal"
                          >
                            {humanizeKey(row.field)}
                          </th>
                          <td className="max-w-64 break-words p-3 font-mono">
                            {String(row.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl bg-secondary p-5 text-sm text-muted-foreground">
                  {rows.length
                    ? "No matching data. Try another search."
                    : "No data has been shared yet. Ask your manager for the information you need."}
                </p>
              )}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
