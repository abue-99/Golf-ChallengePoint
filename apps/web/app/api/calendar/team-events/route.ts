import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

/** GET /api/calendar/team-events?teamId= */
export async function GET(req: NextRequest) {
  try {
    return await proxyJsonWithAuthRetry({
      path: `/calendar/team-events${req.nextUrl.search}`,
      cache: "no-store",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/team-events GET]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/calendar/team-events – create a team event. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: "/calendar/team-events",
      method: "POST",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/team-events POST]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
