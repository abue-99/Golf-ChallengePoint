import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await proxyJsonWithAuthRetry({
      path: `/journeys/${encodeURIComponent(id)}/duplicate`,
      method: "POST",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys/[id]/duplicate POST]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
