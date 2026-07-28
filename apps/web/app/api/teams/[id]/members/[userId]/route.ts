import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

type RawSlot = {
  id: string;
  title: string;
  occurrences?: { start: string }[];
};

type RawPlan = {
  id: string;
  name: string;
};

function buildTeamSlotKeys(
  otherCals: { slots?: RawSlot[] }[],
  otherCount: number
): Set<string> {
  const counts = new Map<string, number>();
  otherCals.forEach((cal) => {
    const seen = new Set<string>();
    (cal?.slots ?? []).forEach((s) => {
      const key = `${s.title}__${s.occurrences?.[0]?.start ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    });
  });
  return new Set(
    Array.from(counts.entries())
      .filter(([, n]) => n >= otherCount)
      .map(([k]) => k)
  );
}

function buildTeamPlanNames(
  otherPlans: RawPlan[][],
  otherCount: number
): Set<string> {
  const counts = new Map<string, number>();
  otherPlans.forEach((plans) => {
    const seen = new Set<string>();
    plans.forEach((p) => {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
      }
    });
  });
  return new Set(
    Array.from(counts.entries())
      .filter(([, n]) => n >= otherCount)
      .map(([k]) => k)
  );
}

/**
 * DELETE /api/teams/[id]/members/[userId]
 *
 * Before removing the player it:
 *  1. Identifies the departing player's calendar slots that are team-assigned
 *     and deletes them.
 *  2. Does the same for development plans.
 *  3. Finally removes the player from the team.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { id: teamId, userId } = await params;

  try {
    const teamRes = await fetch(`${API_URL}/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const team = teamRes.ok ? await teamRes.json().catch(() => null) : null;
    const allMembers: { userId: string }[] = team?.members ?? [];
    const otherMembers = allMembers.filter((m) => m.userId !== userId);

    if (otherMembers.length > 0) {
      const calResults = await Promise.all([
        fetch(`${API_URL}/calendar/player/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).then((r) => (r.ok ? r.json().catch(() => ({ slots: [] })) : { slots: [] })),
        ...otherMembers.map((m) =>
          fetch(`${API_URL}/calendar/player/${m.userId}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }).then((r) => (r.ok ? r.json().catch(() => ({ slots: [] })) : { slots: [] }))
        ),
      ]);

      const [playerCal, ...otherCals] = calResults;
      const playerSlots: RawSlot[] = Array.isArray(playerCal?.slots) ? playerCal.slots : [];
      const teamKeys = buildTeamSlotKeys(otherCals, otherMembers.length);

      const slotIdsToDelete = playerSlots
        .filter((s) => teamKeys.has(`${s.title}__${s.occurrences?.[0]?.start ?? ""}`))
        .map((s) => s.id);

      await Promise.allSettled(
        slotIdsToDelete.map((slotId) =>
          fetch(`${API_URL}/calendar/slots/${slotId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );

      const planResults = await Promise.all([
        fetch(`${API_URL}/development-plans/player/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).then((r) => (r.ok ? r.json().catch(() => []) : [])),
        ...otherMembers.map((m) =>
          fetch(`${API_URL}/development-plans/player/${m.userId}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }).then((r) => (r.ok ? r.json().catch(() => []) : []))
        ),
      ]);

      const [playerPlansRaw, ...otherPlansRaw] = planResults;
      const playerPlanList: RawPlan[] = Array.isArray(playerPlansRaw) ? playerPlansRaw : [];
      const teamNames = buildTeamPlanNames(
        otherPlansRaw.map((p) => (Array.isArray(p) ? p : [])),
        otherMembers.length
      );

      const planIdsToDelete = playerPlanList
        .filter((p) => teamNames.has(p.name))
        .map((p) => p.id);

      await Promise.allSettled(
        planIdsToDelete.map((planId) =>
          fetch(`${API_URL}/development-plans/${planId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
    }

    const res = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/teams/[id]/members/[userId] DELETE]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
