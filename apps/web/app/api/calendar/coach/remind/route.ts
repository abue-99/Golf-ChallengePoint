import { NextRequest } from "next/server";
import { proxyJsonWithAuthRetry } from "@/lib/api-proxy-auth";

/** POST /api/calendar/coach/remind – { occurrenceKey } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return await proxyJsonWithAuthRetry({
      path: "/calendar/coach/remind",
      method: "POST",
      body,
      missingTokenBody: null,
    });
  } catch (err) {
    console.error("[/api/calendar/coach/remind POST]", err);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
