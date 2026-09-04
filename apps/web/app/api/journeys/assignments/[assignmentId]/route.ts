import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { assignmentId } = await params;
    const body = await req.json();
    return await proxyJsonWithAuthRetry({
      path: `/journeys/assignments/${encodeURIComponent(assignmentId)}`,
      method: "PATCH",
      body,
      fallbackBody: {},
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/journeys/assignments/[assignmentId] PATCH]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
