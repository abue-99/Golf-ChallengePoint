import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ journeyId: string; teamId: string }> },
) {
  try {
    const { journeyId, teamId } = await params;
    const body = await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: `/coach/journeys/${encodeURIComponent(journeyId)}/assign/team/${encodeURIComponent(teamId)}`,
      method: "POST",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error(
      "[/api/coach/journeys/[journeyId]/assign/team/[teamId] POST]",
      err,
    );
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
