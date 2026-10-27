import { response } from "@/lib/hiring/http";
import { inviteEntry } from "@/lib/hiring/store";
export const runtime = "nodejs";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return response(async () => inviteEntry((await params).token));
}
