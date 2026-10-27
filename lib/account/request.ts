import { AccountError } from "./error";

export async function boundedJSON(request: Request, max = 20000) {
  if (Number(request.headers.get("content-length")) > max) {
    await request.body?.cancel();
    throw new AccountError("Request is too large.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("Invalid JSON.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new AccountError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AccountError("Invalid JSON.", 400);
  }
}
