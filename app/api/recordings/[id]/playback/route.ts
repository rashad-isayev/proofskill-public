import { hr, response } from "@/lib/hiring/http";
import { playback } from "@/lib/recording/store";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const media = await playback(await hr(), (await params).id);
    return new NextResponse(new Uint8Array(media.data), {
      headers: {
        "Content-Type": media.mime,
        "Content-Length": String(media.data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return response(async () => {
      throw error;
    });
  }
}
