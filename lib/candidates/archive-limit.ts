import JSZip from "jszip";

export const MAX_XLSX_EXPANDED_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 128;
// Validate the actual decompressed stream before ExcelJS accumulates XML/strings.
// ZIP header sizes alone are attacker-controlled and are not a memory boundary.
export async function checkSpreadsheetArchive(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  let entries = -1;
  for (
    let i = view.byteLength - 22;
    i >= Math.max(0, view.byteLength - 65557);
    i--
  ) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === view.byteLength
    ) {
      if (
        view.getUint16(i + 4, true) !== 0 ||
        view.getUint16(i + 6, true) !== 0
      )
        throw new Error("Use a single-file XLSX archive.");
      entries = view.getUint16(i + 10, true);
      break;
    }
  }
  if (entries < 0 || entries > MAX_ENTRIES)
    throw new Error(
      "The spreadsheet archive is invalid or contains too many entries.",
    );
  const archive = await JSZip.loadAsync(bytes);
  if (Object.keys(archive.files).length > MAX_ENTRIES)
    throw new Error("The spreadsheet archive contains too many entries.");
  const stream = archive.generateInternalStream({
    type: "uint8array",
    compression: "STORE",
    streamFiles: true,
  });
  await new Promise<void>((resolve, reject) => {
    let total = 0;
    let stopped = false;
    stream
      .on("data", (chunk) => {
        total += chunk.byteLength;
        if (!stopped && total > MAX_XLSX_EXPANDED_BYTES) {
          stopped = true;
          stream.pause();
          reject(
            new Error(
              "The expanded spreadsheet exceeds the 8 MB import limit.",
            ),
          );
        }
      })
      .on("error", reject)
      .on("end", () => {
        if (!stopped) resolve();
      })
      .resume();
  });
}
