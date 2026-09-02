import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { teamId } = await params;

  try {
    const body = await req.json();
    const res = await fetch(
      `${API_URL}/coach/teams/${encodeURIComponent(teamId)}/assignments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/coach/teams/[teamId]/assignments POST]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
