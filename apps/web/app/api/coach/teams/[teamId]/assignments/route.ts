import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await req.json();
    return await proxyJsonWithAuthRetry({
      path: `/coach/teams/${encodeURIComponent(teamId)}/assignments`,
      method: "POST",
      body,
      fallbackBody: {},
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/coach/teams/[teamId]/assignments POST]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
