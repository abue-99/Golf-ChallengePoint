import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://golf_api:4000";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

/** Fetch team data (including members) from the backend */
async function fetchTeam(token: string, teamId: string) {
  const res = await fetch(`${API_URL}/teams/${teamId}`, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/** Fetch calendar slots for a single player */
async function fetchPlayerCalendar(token: string, playerId: string) {
  const res = await fetch(`${API_URL}/calendar/player/${playerId}`, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!res.ok) return { slots: [] };
  return res.json().catch(() => ({ slots: [] }));
}

type RawSlot = {
  id: string;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences: { start: string; end: string }[];
  tasks: { id: string; title: string; durationMinutes: number; scheduledDate: string }[];
};

/**
 * GET /api/calendar/team-slots/[teamId]
 *
 * Returns a deduplicated list of training windows shared across all team members.
 * Each entry includes `memberSlotIds` so the client can delete/update per-member.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { teamId } = await params;

  try {
    const team = await fetchTeam(token, teamId);
    const members: { userId: string }[] = team?.members ?? [];

    if (members.length === 0) return NextResponse.json([]);

    // Fetch calendars for all members in parallel
    const calendars = await Promise.all(
      members.map((m) => fetchPlayerCalendar(token, m.userId))
    );

    // Collect all slots with a compound key (title + first occurrence start time)
    // to deduplicate team-wide slots
    const slotMap = new Map<
      string,
      { representative: RawSlot; memberSlotIds: string[] }
    >();

    calendars.forEach((cal) => {
      const slots: RawSlot[] = Array.isArray(cal?.slots) ? cal.slots : [];
      slots.forEach((slot) => {
        const key = `${slot.title}__${slot.occurrences?.[0]?.start ?? ""}`;
        const existing = slotMap.get(key);
        if (existing) {
          existing.memberSlotIds.push(slot.id);
        } else {
          slotMap.set(key, { representative: slot, memberSlotIds: [slot.id] });
        }
      });
    });

    const memberCount = members.length;

    // Only return slots that were assigned to ALL team members (i.e. team-wide slots).
    // Individual player slots only appear in one member's calendar and are excluded.
    const teamSlots = Array.from(slotMap.values())
      .filter(({ memberSlotIds }) =>
        // For single-member teams every slot looks like a team slot – include all.
        // For multi-member teams only include slots present for every member.
        memberCount <= 1 || memberSlotIds.length >= memberCount
      )
      .map(({ representative, memberSlotIds }) => ({
        ...representative,
        memberSlotIds,
      }));

    return NextResponse.json(teamSlots);
  } catch (err) {
    console.error("[/api/calendar/team-slots GET]", err);
    return NextResponse.json([], { status: 500 });
  }
}

/**
 * POST /api/calendar/team-slots/[teamId]
 *
 * Creates a training window for every team member (fan-out).
 * Body: { title, startTime, endTime, recurrence, recurrenceEndDate? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  const { teamId } = await params;

  try {
    const body = await req.json();
    const team = await fetchTeam(token, teamId);
    const members: { userId: string }[] = team?.members ?? [];

    if (members.length === 0) {
      return NextResponse.json({ message: "Team has no members" }, { status: 400 });
    }

    // Create the slot for each member in parallel
    const results = await Promise.allSettled(
      members.map((m) =>
        fetch(`${API_URL}/calendar/slots`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ ...body, playerId: m.userId }),
        }).then((r) => r.json().catch(() => ({})))
      )
    );

    const created = results
      .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
      .map((r) => r.value);

    return NextResponse.json({ created, memberCount: members.length });
  } catch (err) {
    console.error("[/api/calendar/team-slots POST]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar/team-slots/[teamId]
 *
 * Deletes a training window from every team member's calendar.
 * Body: { memberSlotIds: string[] }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  await params; // teamId consumed to satisfy route signature

  try {
    const { memberSlotIds } = (await req.json()) as { memberSlotIds: string[] };
    if (!Array.isArray(memberSlotIds) || memberSlotIds.length === 0) {
      return NextResponse.json({ message: "memberSlotIds required" }, { status: 400 });
    }

    await Promise.allSettled(
      memberSlotIds.map((slotId) =>
        fetch(`${API_URL}/calendar/slots/${slotId}`, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/calendar/team-slots DELETE]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/calendar/team-slots/[teamId]
 *
 * Updates a training window for every team member's calendar.
 * Body: { memberSlotIds: string[], ...updateFields }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const token = await getToken();
  if (!token) return NextResponse.json(null, { status: 401 });
  await params; // teamId consumed to satisfy route signature

  try {
    const { memberSlotIds, ...updateFields } = (await req.json()) as {
      memberSlotIds: string[];
      [key: string]: unknown;
    };

    if (!Array.isArray(memberSlotIds) || memberSlotIds.length === 0) {
      return NextResponse.json({ message: "memberSlotIds required" }, { status: 400 });
    }

    await Promise.allSettled(
      memberSlotIds.map((slotId) =>
        fetch(`${API_URL}/calendar/slots/${slotId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(updateFields),
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/calendar/team-slots PATCH]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
