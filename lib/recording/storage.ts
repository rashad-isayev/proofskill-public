import "server-only";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { HiringError } from "@/lib/hiring/error";
const idPattern = /^[a-f0-9-]{36}$/;
function directory(id: string) {
  if (!idPattern.test(id)) throw new HiringError("Invalid recording.", 400);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw new HiringError(
      "Private hosted recording storage is not configured.",
      503,
    );
  const root = process.env.RECORDING_LOCAL_DIRECTORY;
  if (!root || !root.startsWith("/"))
    throw new HiringError(
      "Private local recording storage is not configured.",
      503,
    );
  return join(resolve(root), id);
}
export async function writeChunk(id: string, sequence: number, data: Buffer) {
  const dir = directory(id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // Atomic replacement is safe only for the same authenticated idempotent chunk.
  await writeFile(join(dir, String(sequence) + ".webm"), data, { mode: 0o600 });
}
export async function readChunk(id: string, sequence: number) {
  return readFile(join(directory(id), String(sequence) + ".webm"));
}
export async function removeRecording(id: string) {
  await rm(directory(id), { recursive: true, force: true });
}
