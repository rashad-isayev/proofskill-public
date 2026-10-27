import { response } from "@/lib/hiring/http";
import { monitoringStatus } from "@/lib/hiring/monitoring";
export const runtime = "nodejs";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return response(async () => monitoringStatus((await params).token));
}
