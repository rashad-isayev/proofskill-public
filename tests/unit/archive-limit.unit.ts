import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import {
  checkSpreadsheetArchive,
  MAX_XLSX_EXPANDED_BYTES,
} from "../../lib/candidates/archive-limit";
import { readSpreadsheet } from "../../lib/candidates/read-spreadsheet";

test("spreadsheet preflight accepts normal XLSX imports and rejects invalid/excessive archives", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Candidates").addRows([
    ["Name", "Email"],
    ["Synthetic", "synthetic@example.test"],
  ]);
  const bytes = await book.xlsx.writeBuffer();
  const file = new File([new Uint8Array(bytes)], "test.xlsx");
  assert.equal((await readSpreadsheet(file))[0].rows[0][0], "Synthetic");
  await assert.rejects(
    () => checkSpreadsheetArchive(new ArrayBuffer(2)),
    /invalid/,
  );
  const zip = new JSZip();
  for (let i = 0; i < 129; i++) zip.file(String(i), "small");
  const many = await zip.generateAsync({ type: "arraybuffer" });
  await assert.rejects(() => checkSpreadsheetArchive(many), /too many/);
});
test("spreadsheet expansion is bounded by actual decompressed bytes, including false declared sizes", async () => {
  const zip = new JSZip();
  zip.file("xl/worksheets/sheet1.xml", "x".repeat(MAX_XLSX_EXPANDED_BYTES + 1));
  const bytes = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
  });
  assert(bytes.byteLength < 20000);
  await assert.rejects(
    () => checkSpreadsheetArchive(bytes),
    /expanded spreadsheet/,
  );
  const lied = bytes.slice(0),
    view = new DataView(lied);
  for (let i = 0; i < view.byteLength - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) view.setUint32(i + 24, 1, true);
  await assert.rejects(
    () => checkSpreadsheetArchive(lied),
    /expanded spreadsheet|size mismatch/,
  );
});
