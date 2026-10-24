import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * Calendar subscription:
 *   GET  /api/calendar/feed             → the caller's feed token (cookie auth)
 *   POST /api/calendar/feed/rotate      → new token (cookie auth)
 *   GET  /api/calendar/feed/ics/<t>.ics → the ICS file, public; the secret
 *        token in the URL is the auth, because calendar apps send no cookies.
 */
export async function GET(req: NextRequest, context: Context) {
  const { path = [] } = await context.params;

  if (path[0] === "ics" && path.length === 2) {
    const res = await fetch(
      `${API_URL}/calendar/feed/ics/${encodeURIComponent(path[1])}`,
      {
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return new NextResponse("Calendar not found", { status: res.status });
    }
    return new NextResponse(await res.text(), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="challengepoint.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  if (path.length > 0) return NextResponse.json(null, { status: 404 });
  return proxyWithCookie("GET", "feed");
}

export async function POST(_req: NextRequest, context: Context) {
  const { path = [] } = await context.params;
  if (path.length !== 1 || path[0] !== "rotate") {
    return NextResponse.json(null, { status: 404 });
  }
  return proxyWithCookie("POST", "feed/rotate");
}

async function proxyWithCookie(method: "GET" | "POST", target: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json(null, { status: 401 });
  const res = await fetch(`${API_URL}/calendar/${target}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
