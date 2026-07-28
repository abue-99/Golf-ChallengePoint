import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

type RawPlan = { id: string; name: string };
type TeamMember = { userId: string };
type Team = { id: string; shortName: string; members: TeamMember[] };

/**
 * GET /api/development-plans/team-sources/[playerId]
 *
 * Returns a map of  planName -> teamShortName  for every development plan
 * the given player has that was assigned through a team (i.e. the same plan
 * name exists for every member of at least one of the caller\'s teams).
 *
 * Requires a COACH / ADMIN session token.
 * Silently returns {} when the caller does not have access to team data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json({}, { status: 401 });
  const { playerId } = await params;

  try {
    // 1. Fetch all teams managed by this coach
    const teamsRes = await fetch(`${API_URL}/teams`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!teamsRes.ok) return NextResponse.json({}); // player token -> no team access, return empty

    const teams: Team[] = await teamsRes.json().catch(() => []);

    // 2. Keep only teams where the target player is a member
    const relevantTeams = teams.filter((t) =>
      t.members.some((m) => m.userId === playerId)
    );

    if (relevantTeams.length === 0) return NextResponse.json({});

    // 3. Build planName -> teamShortName by cross-referencing all members\' plans
    const result: Record<string, string> = {};

    await Promise.all(
      relevantTeams.map(async (team) => {
        const members = team.members;
        if (members.length === 0) return;

        // Fetch each member\'s plans in parallel
        const allMemberPlans = await Promise.all(
          members.map((m) =>
            fetch(`${API_URL}/development-plans/player/${m.userId}`, {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }).then((r) => (r.ok ? r.json().catch(() => []) : []))
          )
        );

        // Count how many members have each plan name
        const nameCounts = new Map<string, number>();
        allMemberPlans.forEach((plans) => {
          const seen = new Set<string>();
          (Array.isArray(plans) ? plans : []).forEach((p: RawPlan) => {
            if (!seen.has(p.name)) {
              seen.add(p.name);
              nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
            }
          });
        });

        // Plans present for ALL members are team-assigned
        nameCounts.forEach((count, name) => {
          if (count >= members.length) {
            result[name] = team.shortName;
          }
        });
      })
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/development-plans/team-sources GET]", err);
    return NextResponse.json({});
  }
}
