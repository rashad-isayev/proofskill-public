import { bearer, body, response } from "@/lib/hiring/http";
import { recordingFinishSchema } from "@/lib/recording/contracts";
import { finishRecording } from "@/lib/recording/store";
export const runtime = "nodejs";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () =>
    finishRecording(
      bearer(r),
      (await params).id,
      await body(r, recordingFinishSchema),
    ),
  );
}
