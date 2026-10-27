import { z } from "zod";
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
  token?: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(210000),
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The service returned an unreadable response. Your work is preserved; please retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      data.error?.message ||
        (response.status === 404
          ? "This item could not be found. It may have been removed or you may not have access."
          : "The request failed. Please retry."),
    );
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new Error(
      "The service returned invalid data. Please retry; the server may already have saved your request.",
    );
  return parsed.data;
}
