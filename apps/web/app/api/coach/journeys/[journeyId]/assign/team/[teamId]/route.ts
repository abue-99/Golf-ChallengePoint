import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ journeyId: string; teamId: string }> },
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { journeyId, teamId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(
      `${API_URL}/coach/journeys/${encodeURIComponent(journeyId)}/assign/team/${encodeURIComponent(teamId)}`,
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
    console.error(
      "[/api/coach/journeys/[journeyId]/assign/team/[teamId] POST]",
      err,
    );
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
