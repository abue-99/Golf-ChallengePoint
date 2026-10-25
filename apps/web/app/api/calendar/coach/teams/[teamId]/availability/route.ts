import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

/** GET /api/calendar/coach/teams/:teamId/availability?from=&to= – time finder. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    return await proxyJsonWithAuthRetry({
      path: `/calendar/coach/teams/${encodeURIComponent(teamId)}/availability${req.nextUrl.search}`,
      method: "GET",
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/coach/teams/[teamId]/availability GET]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
