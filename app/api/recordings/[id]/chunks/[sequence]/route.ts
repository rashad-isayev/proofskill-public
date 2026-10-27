import { bearer, response } from "@/lib/hiring/http";
import { checkOrigin } from "@/lib/account/access";
import { HiringError } from "@/lib/hiring/error";
import { uploadChunk } from "@/lib/recording/store";
export const runtime = "nodejs";
export async function PUT(
  r: Request,
  { params }: { params: Promise<{ id: string; sequence: string }> },
) {
  return response(async () => {
    checkOrigin(r);
    const token = bearer(r);
    const { id, sequence } = await params;
    if (!/^(0|[1-9]\d{0,2})$/.test(sequence))
      throw new HiringError("Invalid recording sequence.", 400);
    if (!r.headers.get("content-type")?.startsWith("video/webm"))
      throw new HiringError("WebM video is required.", 400);
    const reader = r.body?.getReader();
    if (!reader) throw new HiringError("Recording chunk is empty.", 400);
    let size = 0;
    const parts: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8388608) {
          await reader.cancel();
          throw new HiringError(
            "Recording chunk exceeds the upload limit.",
            413,
          );
        }
        parts.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return uploadChunk(token, id, Number(sequence), Buffer.concat(parts));
  });
}
