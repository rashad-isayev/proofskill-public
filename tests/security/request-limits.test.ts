import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedJSON } from "../../lib/account/request";

function streamed(parts: Uint8Array[], contentLength?: string) {
  let read = 0;
  let cancelled = false;
  const request = new Request("http://localhost/api/simulations/start", {
    method: "POST",
    headers: contentLength ? { "content-length": contentLength } : {},
    body: new ReadableStream(
      {
        pull(controller) {
          if (read < parts.length) controller.enqueue(parts[read++]);
          else controller.close();
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    ),
    duplex: "half",
  } as RequestInit);
  return { request, reads: () => read, cancelled: () => cancelled };
}
const bytes = (text: string) => new TextEncoder().encode(text);
const tooLarge = (error: unknown) =>
  error instanceof Error && "status" in error && error.status === 413;

test("rejects an oversized declared length before reading any bytes", async () => {
  const input = streamed([bytes("{}")], "999");
  await assert.rejects(() => boundedJSON(input.request, 10), tooLarge);
  assert.equal(input.reads(), 0);
  assert.equal(input.cancelled(), true);
});
test("cancels oversized chunked JSON without consuming the rest", async () => {
  const input = streamed([
    bytes('{"x":"'),
    bytes("a".repeat(20)),
    bytes("b".repeat(20)),
    bytes('"}'),
  ]);
  await assert.rejects(() => boundedJSON(input.request, 10), tooLarge);
  assert.equal(input.reads(), 2);
  assert.equal(input.cancelled(), true);
});
test("counts UTF-8 bytes and rejects false small lengths", async () => {
  const input = streamed([bytes('{"x":"ééé"}')], "1");
  await assert.rejects(() => boundedJSON(input.request, 12), tooLarge);
});
test("accepts bounded multibyte JSON split across byte boundaries", async () => {
  const data = bytes('{"x":"é"}');
  const input = streamed([data.slice(0, 7), data.slice(7)]);
  assert.deepEqual(await boundedJSON(input.request, data.length), { x: "é" });
});
test("returns 400 for malformed or empty JSON", async () => {
  for (const content of ["", "{"]) {
    await assert.rejects(
      () => boundedJSON(streamed([bytes(content)]).request),
      (error: unknown) =>
        error instanceof Error && "status" in error && error.status === 400,
    );
  }
});
