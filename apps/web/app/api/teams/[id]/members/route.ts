import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

type RawSlot = {
  id: string;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences?: { start: string; end: string }[];
};

type RawPlan = {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * POST /api/teams/[id]/members
 *
 * Adds a player to the team, then fans out the team's existing training windows
 * and development plans to the new member so they are immediately in sync.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { id: teamId } = await params;
  const body = await req.json();
  const newUserId: string = body.userId;

  // ── 1. Add the member ────────────────────────────────────────────────────────
  const addRes = await fetch(`${API_URL}/teams/${teamId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `******,
    body: JSON.stringify(body),
  });
  const addData = await addRes.json().catch(() => ({}));
  if (!addRes.ok) {
    return NextResponse.json(addData, { status: addRes.status });
  }

  // ── 2. Identify existing team members (excluding the just-added one) ─────────
  const updatedTeam = addData; // backend returns the updated team
  const allMembers: { userId: string }[] = updatedTeam?.members ?? [];
  const existingMembers = allMembers.filter((m) => m.userId !== newUserId);

  if (existingMembers.length === 0) {
    // First member – nothing to fan out
    return NextResponse.json(addData, { status: addRes.status });
  }

  try {
    // ── 3. Fan-out team training windows ──────────────────────────────────────
    const calResults = await Promise.all(
      existingMembers.map((m) =>
        fetch(`${API_URL}/calendar/player/${m.userId}`, {
          headers: { Authorization: `******,
          cache: "no-store",
        }).then((r) => (r.ok ? r.json().catch(() => ({ slots: [] })) : { slots: [] }))
      )
    );

    // Identify team slots: those present in ALL existing members (same title+startTime)
    const slotKeyCounts = new Map<string, { slot: RawSlot; count: number }>();
    calResults.forEach((cal) => {
      const seen = new Set<string>();
      (cal?.slots ?? []).forEach((s: RawSlot) => {
        const key = `${s.title}__${s.occurrences?.[0]?.start ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          const existing = slotKeyCounts.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            slotKeyCounts.set(key, { slot: s, count: 1 });
          }
        }
      });
    });

    const teamSlots = Array.from(slotKeyCounts.values()).filter(
      ({ count }) => count >= existingMembers.length
    );

    // Create each team slot for the new member
    await Promise.allSettled(
      teamSlots.map(({ slot }) => {
        const firstOcc = slot.occurrences?.[0];
        if (!firstOcc) return Promise.resolve();
        return fetch(`${API_URL}/calendar/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `******,
          body: JSON.stringify({
            playerId: newUserId,
            title: slot.title,
            startTime: firstOcc.start,
            endTime: firstOcc.end,
            recurrence: slot.recurrence,
            recurrenceEndDate: slot.recurrenceEndDate ?? null,
          }),
        });
      })
    );

    // ── 4. Fan-out team development plans ────────────────────────────────────
    const planResults = await Promise.all(
      existingMembers.map((m) =>
        fetch(`${API_URL}/development-plans/player/${m.userId}`, {
          headers: { Authorization: `******,
          cache: "no-store",
        }).then((r) => (r.ok ? r.json().catch(() => []) : []))
      )
    );

    // Identify team plans: those present in ALL existing members (same name)
    const planNameCounts = new Map<string, { plan: RawPlan; count: number }>();
    planResults.forEach((plans) => {
      const seen = new Set<string>();
      (Array.isArray(plans) ? plans : []).forEach((p: RawPlan) => {
        if (!seen.has(p.name)) {
          seen.add(p.name);
          const existing = planNameCounts.get(p.name);
          if (existing) {
            existing.count += 1;
          } else {
            planNameCounts.set(p.name, { plan: p, count: 1 });
          }
        }
      });
    });

    const teamPlans = Array.from(planNameCounts.values()).filter(
      ({ count }) => count >= existingMembers.length
    );

    // Create each team plan for the new member
    await Promise.allSettled(
      teamPlans.map(({ plan }) =>
        fetch(`${API_URL}/development-plans`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `******,
          body: JSON.stringify({
            playerId: newUserId,
            name: plan.name,
            description: plan.description ?? undefined,
            startDate: plan.startDate ?? undefined,
            endDate: plan.endDate ?? undefined,
          }),
        })
      )
    );
  } catch (err) {
    // Fan-out failures are non-fatal – the member was already added successfully.
    console.error("[/api/teams/[id]/members POST] fan-out error:", err);
  }

  return NextResponse.json(addData, { status: addRes.status });
}
