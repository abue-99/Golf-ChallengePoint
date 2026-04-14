import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

/** GET /api/players/my – players linked to the current coach/admin */
export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  const res = await fetch(`${API_URL}/users/me/players`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ([]));
  return NextResponse.json(data, { status: res.status });
}

/** POST /api/players/my – body: { playerId } – links an existing player to the current coach */
export async function POST(req: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  const { playerId } = await req.json();
  const res = await fetch(`${API_URL}/users/me/players/${encodeURIComponent(playerId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
