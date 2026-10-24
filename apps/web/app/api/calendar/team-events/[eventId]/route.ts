import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

type Params = { params: Promise<{ eventId: string }> };

/** PATCH /api/calendar/team-events/:eventId */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    const body = await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: `/calendar/team-events/${encodeURIComponent(eventId)}`,
      method: "PATCH",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/team-events/[eventId] PATCH]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/calendar/team-events/:eventId */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { eventId } = await params;
    return await proxyJsonWithAuthRetry({
      path: `/calendar/team-events/${encodeURIComponent(eventId)}`,
      method: "DELETE",
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/team-events/[eventId] DELETE]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
