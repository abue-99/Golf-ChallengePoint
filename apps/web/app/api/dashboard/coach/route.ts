import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

function isSameDay(date: Date, today: Date): boolean {
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });

  const payload = verifyJwt<{ sub: string }>(token);
  if (!payload?.sub) return NextResponse.json(null, { status: 401 });

  const authHeader = `******;

  try {
    const [teamsRes, playersRes, slotsRes] = await Promise.all([
      fetch(`${API_URL}/teams`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      }),
      fetch(`${API_URL}/players/my`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      }),
      fetch(`${API_URL}/calendar/slots`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      }),
    ]);

    type TeamMember = { id: string };
    type Team = { id: string; shortName: string; icon?: string | null; members?: TeamMember[]; _count?: { members: number } };
    const teams: Team[] = teamsRes.ok ? await teamsRes.json().catch(() => []) : [];

    type Player = { id: string; firstName?: string | null; lastName?: string | null; email: string; lastLogin?: string | null };
    const players: Player[] = playersRes.ok ? await playersRes.json().catch(() => []) : [];

    type Slot = { id: string; title: string; startTime: string; endTime: string; ownerType: string };
    const allSlots: Slot[] = slotsRes.ok ? await slotsRes.json().catch(() => []) : [];

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Today's agenda
    const todaySlots = allSlots
      .filter((s) => isSameDay(new Date(s.startTime), now))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Attention items
    const playersWithoutLogin = players.filter(
      (p) => !p.lastLogin || new Date(p.lastLogin) < sevenDaysAgo
    ).length;

    // Team cards with member counts
    const teamCards = teams.map((t) => ({
      id: t.id,
      shortName: t.shortName,
      icon: t.icon ?? null,
      memberCount: t._count?.members ?? t.members?.length ?? 0,
    }));

    return NextResponse.json({
      todaySlots,
      teamCards,
      attentionItems: {
        playersWithoutLogin,
      },
      totalPlayers: players.length,
      totalTeams: teams.length,
      todayTrainingCount: todaySlots.length,
    });
  } catch (err) {
    console.error("[/api/dashboard/coach GET]", err);
    return NextResponse.json(
      {
        todaySlots: [],
        teamCards: [],
        attentionItems: { playersWithoutLogin: 0 },
        totalPlayers: 0,
        totalTeams: 0,
        todayTrainingCount: 0,
      },
      { status: 500 }
    );
  }
}
