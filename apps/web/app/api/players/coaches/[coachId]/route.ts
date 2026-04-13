import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

/** DELETE /api/players/coaches/[coachId] – remove a coach link */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ coachId: string }> },
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  const { coachId } = await params;
  const res = await fetch(`${API_URL}/users/me/coaches/${coachId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
