import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { id, userId } = await params;

  try {
    const res = await fetch(`${API_URL}/teams/${id}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/teams/[id]/members/[userId] DELETE]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
