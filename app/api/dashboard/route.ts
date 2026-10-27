import { hr, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { publicDashboard } from "@/lib/hiring/presentation";
import { dashboard } from "@/lib/hiring/store";
export async function GET() {
  return response(async () => publicDashboard(await dashboard(await hr())));
}
