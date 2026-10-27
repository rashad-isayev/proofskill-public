import { hr, response } from "@/lib/hiring/http";
import { listRecordings } from "@/lib/recording/store";
export const runtime = "nodejs";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () => listRecordings(await hr(), (await params).id));
}
