import { z } from "zod";

export const signInInput = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export const signUpInput = signInInput.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128),
});

export async function boundedJson(
  request: Request,
  maxBytes = 8192,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return null;
  if (
    Number(request.headers.get("content-length") ?? 0) > maxBytes ||
    !request.body
  )
    return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
