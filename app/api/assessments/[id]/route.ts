import { hr, response } from "@/lib/hiring/http";
export const runtime = "nodejs";
export const maxDuration = 120;
import { publicDetails } from "@/lib/hiring/presentation";
import { assessmentDetails } from "@/lib/hiring/store";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () =>
    publicDetails(await assessmentDetails(await hr(), (await params).id)),
  );
}
