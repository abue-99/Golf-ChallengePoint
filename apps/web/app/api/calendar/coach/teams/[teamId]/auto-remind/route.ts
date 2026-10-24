import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

/** PUT /api/calendar/coach/teams/:teamId/auto-remind – { hours: number | null } */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: `/calendar/coach/teams/${encodeURIComponent(teamId)}/auto-remind`,
      method: "PUT",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/coach/teams/[teamId]/auto-remind PUT]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
