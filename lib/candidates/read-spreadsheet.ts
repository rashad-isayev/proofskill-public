import { checkSpreadsheetArchive } from "./archive-limit";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseCSV,
  toSheet,
  type ImportSheet,
} from "./import";

// Parsing happens only in the browser. File contents are not uploaded before confirmation.
export async function readSpreadsheet(file: File): Promise<ImportSheet[]> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error("Choose a file smaller than 2 MB.");
  if (/\.csv$/i.test(file.name))
    return [toSheet(file.name, parseCSV(await file.text()))];
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("Choose an .xlsx or .csv file.");
  const bytes = await file.arrayBuffer();
  await checkSpreadsheetArchive(bytes);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as Parameters<typeof workbook.xlsx.load>[0]);
  const sheets: ImportSheet[] = [];
  for (const worksheet of workbook.worksheets) {
    if (worksheet.rowCount > MAX_IMPORT_ROWS + 1 || worksheet.columnCount > 50)
      throw new Error("Use up to 500 candidates and 50 columns per sheet.");
    const rows: string[][] = [];
    worksheet.eachRow((row) => {
      const cells: string[] = [];
      for (let i = 1; i <= worksheet.columnCount; i++) {
        const cell = row.getCell(i);
        if (cell.type === ExcelJS.ValueType.Formula)
          throw new Error(
            "Replace formula cells with plain values before importing.",
          );
        cells.push(cell.text);
      }
      rows.push(cells);
    });
    if (rows.length > 1) sheets.push(toSheet(worksheet.name, rows));
  }
  if (!sheets.length) throw new Error("No candidate rows were found.");
  return sheets;
}
