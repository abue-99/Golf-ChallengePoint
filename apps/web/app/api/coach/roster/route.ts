import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

/** GET /api/coach/roster?tz=… – teams and players for the coach home page */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  const tz = req.nextUrl.searchParams.get("tz");
  const query = tz ? `?tz=${encodeURIComponent(tz)}` : "";
  const res = await fetch(`${API_URL}/coach/roster${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data, { status: res.status });
}
