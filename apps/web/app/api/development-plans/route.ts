import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

// POST /api/development-plans  → create a plan
export async function POST(req: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  try {
    const body = await req.json();

    // Team fan-out: create a plan for every team member
    if (body.teamId) {
      const teamRes = await fetch(`${API_URL}/teams/${body.teamId}`, {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!teamRes.ok) {
        return NextResponse.json({ message: "Team not found" }, { status: 404 });
      }
      const team = await teamRes.json().catch(() => null);
      const members: { userId: string }[] = team?.members ?? [];

      if (members.length === 0) {
        return NextResponse.json({ message: "Team has no members" }, { status: 400 });
      }

      const { teamId: _teamId, ...planFields } = body;
      const results = await Promise.allSettled(
        members.map((m) =>
          fetch(`${API_URL}/development-plans`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ ...planFields, playerId: m.userId }),
          }).then((r) => r.json().catch(() => ({})))
        )
      );

      const created = results
        .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
        .map((r) => r.value);

      // Return the first successfully created plan so the UI can update
      return NextResponse.json(created[0] ?? {}, { status: 201 });
    }

    // Single-player plan creation (existing behaviour)
    const res = await fetch(`${API_URL}/development-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/development-plans POST]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
