import { bearer, body, response } from "@/lib/hiring/http";
import {
  recordMonitoringEvents,
  eventBatchSchema,
} from "@/lib/hiring/monitoring";
export const runtime = "nodejs";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () =>
    recordMonitoringEvents(
      bearer(r),
      (await params).id,
      (await body(r, eventBatchSchema)).events,
    ),
  );
}
