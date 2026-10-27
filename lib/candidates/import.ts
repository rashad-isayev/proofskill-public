import { candidateInputSchema, type CandidateInput } from "./contracts";
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export type ImportSheet = { name: string; headers: string[]; rows: string[][] };
export type ColumnMapping = { name: number; email: number; position: number };
export type PreviewRow = {
  row: number;
  input: CandidateInput;
  status: "ready" | "duplicate" | "invalid";
  reason: string;
};

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    if (row.length > 50)
      throw new Error("Use a spreadsheet with at most 50 columns.");
    cell = "";
    closed = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((v) => v.trim())) rows.push(row);
    row = [];
    if (rows.length > MAX_IMPORT_ROWS + 1)
      throw new Error("Import up to 500 candidates at a time.");
  };
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ",") pushCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (closed && c.trim())
        throw new Error("The CSV contains malformed quoted values.");
      cell += c;
    }
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  if (cell || row.length) pushRow();
  return rows;
}
export function toSheet(name: string, rows: string[][]): ImportSheet {
  const nonempty = rows.filter((r) => r.some((s) => s.trim()));
  if (nonempty.length < 2)
    throw new Error("Include a header row and at least one candidate.");
  if (nonempty.length > MAX_IMPORT_ROWS + 1)
    throw new Error("Import up to 500 candidates at a time.");
  if (nonempty[0].length > 50 || nonempty.some((r) => r.length > 50))
    throw new Error("Use a spreadsheet with at most 50 columns.");
  return {
    name,
    headers: nonempty[0].map((h, i) => h.trim() || `Column ${i + 1}`),
    rows: nonempty.slice(1),
  };
}
export function suggestedMapping(headers: string[]): ColumnMapping {
  const index = (names: string[]) =>
    headers.findIndex((h) => names.includes(h.trim().toLowerCase()));
  return {
    name: index(["name", "candidate name", "full name"]),
    email: index(["email", "email address", "candidate email"]),
    position: index(["position", "role", "job title"]),
  };
}
export function previewImport(
  sheet: ImportSheet,
  mapping: ColumnMapping,
  existing: string[],
): PreviewRow[] {
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  return sheet.rows.map((cells, i) => {
    const input = {
      name: (cells[mapping.name] ?? "").trim(),
      email: (cells[mapping.email] ?? "").trim().toLowerCase(),
      position: (cells[mapping.position] ?? "").trim(),
    };
    const parsed = candidateInputSchema.safeParse(input);
    if (!parsed.success)
      return {
        row: i + 2,
        input,
        status: "invalid",
        reason: parsed.error.issues
          .map((e) => `${String(e.path[0])}: ${e.message}`)
          .join("; "),
      };
    if (seen.has(input.email))
      return {
        row: i + 2,
        input,
        status: "duplicate",
        reason: "Email already exists in your directory or this file.",
      };
    seen.add(input.email);
    return { row: i + 2, input: parsed.data, status: "ready", reason: "" };
  });
}
