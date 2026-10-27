"use client";
import { Select } from "@/components/ui/input";
import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/b2b/client";
import { importResultSchema } from "@/lib/candidates/contracts";
import {
  previewImport,
  suggestedMapping,
  type ImportSheet,
  type ColumnMapping,
} from "@/lib/candidates/import";
import { readSpreadsheet } from "@/lib/candidates/read-spreadsheet";
import { Button } from "@/components/ui/button";
import { CandidateModal } from "./candidate-modal";
import { Failure } from "./common";
export function CandidateImport({
  emails,
  onClose,
  onSaved,
}: {
  emails: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: -1,
    email: -1,
    position: -1,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const sheet = sheets[sheetIndex];
  const preview = useMemo(
    () => (sheet ? previewImport(sheet, mapping, emails) : []),
    [sheet, mapping, emails],
  );
  const ready = preview.filter((r) => r.status === "ready");
  const validMapping =
    mapping.name >= 0 &&
    mapping.email >= 0 &&
    mapping.name !== mapping.email &&
    (mapping.position < 0 ||
      (mapping.position !== mapping.name &&
        mapping.position !== mapping.email));
  async function load(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSheets([]);
    try {
      const loaded = await readSpreadsheet(file);
      setSheets(loaded);
      setSheetIndex(0);
      setMapping(suggestedMapping(loaded[0].headers));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The spreadsheet could not be read.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const candidates = ready.map((r) => r.input),
        key = JSON.stringify(candidates);
      if (request.current?.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const result = await api("/api/candidates/import", importResultSchema, {
        candidates,
        requestId: request.current.id,
      });
      onSaved(
        `${result.created} candidates imported. ${result.skipped.length} duplicates skipped by the server.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <CandidateModal title="Import candidates" busy={busy} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm">
          Excel or CSV file
          <input
            aria-label="Candidate spreadsheet"
            className="mt-2 block max-w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
            type="file"
            accept=".xlsx,.csv"
            disabled={busy}
            onChange={(e) => void load(e.target.files?.[0])}
          />
        </label>
        <a
          className="text-sm text-primary hover:underline"
          download="candidates-template.csv"
          href="data:text/csv;charset=utf-8,Name%2CEmail%2CPosition%0A"
        >
          Download CSV template
        </a>
      </div>
      {error && <Failure message={error} />}
      {sheet && (
        <>
          {sheets.length > 1 && (
            <label className="mt-5 block text-sm">
              Worksheet
              <Select
                className="mt-2 w-full"
                aria-label="Worksheet"
                value={sheetIndex}
                disabled={busy}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setSheetIndex(i);
                  setMapping(suggestedMapping(sheets[i].headers));
                }}
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <fieldset disabled={busy} className="mt-6 grid gap-4 sm:grid-cols-3">
            {(["name", "email", "position"] as const).map((field) => (
              <label key={field} className="text-sm capitalize">
                {field} column
                <Select
                  className="mt-2 w-full"
                  aria-label={`${field} column`}
                  value={mapping[field]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [field]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>
                    {field === "position" ? "Not included" : "Choose column"}
                  </option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </fieldset>
          {!validMapping && (
            <p className="mt-4 text-sm text-warning">
              Choose distinct name and email columns. Position is optional.
            </p>
          )}
          <p role="status" className="my-5 text-sm">
            {ready.length} ready ·{" "}
            {preview.filter((r) => r.status === "duplicate").length} duplicates
            · {preview.filter((r) => r.status === "invalid").length} invalid
          </p>
          <div
            className="max-h-80 overflow-auto rounded-xl bg-secondary/30"
            tabIndex={0}
            role="region"
            aria-label="Candidate import preview"
          >
            <table className="ui-table min-w-[650px]">
              <caption className="sr-only">Candidate import preview</caption>
              <thead className="sticky top-0 bg-secondary text-xs">
                <tr>
                  {["Row", "Name", "Email", "Position", "Result"].map((h) => (
                    <th scope="col" className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.row} className="border-t border-border">
                    <td className="p-3">{r.row}</td>
                    <td className="p-3">{r.input.name}</td>
                    <td className="p-3">{r.input.email}</td>
                    <td className="p-3">{r.input.position || "—"}</td>
                    <td className="p-3">
                      <span className="capitalize">{r.status}</span>
                      {r.reason && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {r.reason}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              disabled={busy || !validMapping || !ready.length}
              onClick={() => void save()}
            >
              {busy ? "Importing…" : `Import ${ready.length} candidates`}
            </Button>
          </div>
        </>
      )}
    </CandidateModal>
  );
}
