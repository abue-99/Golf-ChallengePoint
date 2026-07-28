import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { teamId } = await params;
  try {
    // Fetch team to get members (fan-out pattern matching team-slots)
    const teamRes = await fetch(`${API_URL}/teams/${teamId}`, {
      headers: { Authorization: "Bearer " + token },
      cache: "no-store",
    });
    if (!teamRes.ok) return NextResponse.json([], { status: teamRes.status });
    const team = await teamRes.json().catch(() => null);
    const members: { userId: string }[] = team?.members ?? [];

    if (members.length === 0) return NextResponse.json([]);

    // Fetch plans for all members in parallel
    const allPlans = await Promise.all(
      members.map(async (m) => {
        const res = await fetch(`${API_URL}/development-plans/player/${m.userId}`, {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (!res.ok) return [];
        return res.json().catch(() => []);
      })
    );

    return NextResponse.json(allPlans.flat());
  } catch (err) {
    console.error("[/api/development-plans/team GET]", err);
    return NextResponse.json([], { status: 500 });
  }
}
