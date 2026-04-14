import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

/** DELETE /api/players/my/[playerId] – unlinks a player from the current coach */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  const { playerId } = await params;
  const res = await fetch(`${API_URL}/users/me/players/${encodeURIComponent(playerId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
