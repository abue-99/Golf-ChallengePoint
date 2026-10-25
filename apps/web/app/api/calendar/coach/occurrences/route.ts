import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

/**
 * PUT /api/calendar/coach/occurrences – move, cancel or restore one date of
 * a team training: { occurrenceKey, action, startTime?, endTime?, reason?,
 * notify?, force? }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: "/calendar/coach/occurrences",
      method: "PUT",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/coach/occurrences PUT]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
