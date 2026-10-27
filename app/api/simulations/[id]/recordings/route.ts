import { body, bearer, response } from "@/lib/hiring/http";
import { recordingStartSchema } from "@/lib/recording/contracts";
import { startRecording } from "@/lib/recording/store";
export const runtime = "nodejs";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return response(async () =>
    startRecording(
      bearer(r),
      (await params).id,
      await body(r, recordingStartSchema),
    ),
  );
}
