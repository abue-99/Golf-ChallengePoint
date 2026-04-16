import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { playerId } = await params;

  try {
    const res = await fetch(`${API_URL}/calendar/player/${playerId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ slots: [] }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/calendar/player/[playerId] GET]", err);
    return NextResponse.json({ slots: [] }, { status: 500 });
  }
}
