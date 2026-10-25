import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

/** POST /api/lessons/:id/copy – copy a club or public lesson into my library. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await proxyJsonWithAuthRetry({
      path: `/lessons/${encodeURIComponent(id)}/copy`,
      method: "POST",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/lessons/[id]/copy POST]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
