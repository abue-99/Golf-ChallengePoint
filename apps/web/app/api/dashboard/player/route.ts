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

  const playerId = payload.sub;
  const authHeader = `******;

  try {
    const [slotsRes, plansRes] = await Promise.all([
      fetch(`${API_URL}/calendar/slots?playerId=${encodeURIComponent(playerId)}`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      }),
      fetch(`${API_URL}/development-plans/my-plans`, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      }),
    ]);

    const allSlots: Array<{
      id: string;
      title: string;
      startTime: string;
      endTime: string;
      tasks?: Array<{ id: string; title: string; durationMinutes: number }>;
    }> = slotsRes.ok ? await slotsRes.json().catch(() => []) : [];

    const plans: Array<{
      id: string;
      name: string;
      blocks: Array<{
        id: string;
        name: string;
        sortOrder: number;
        assignments: Array<{ id: string; status: string; priority: string; lesson: { id: string; name: string; focusArea: string; durationMinutes: number } }>;
      }>;
    }> = plansRes.ok ? await plansRes.json().catch(() => []) : [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter slots for today and future
    const todaySlots = allSlots
      .filter((s) => isSameDay(new Date(s.startTime), today))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const nextSlot =
      allSlots
        .filter((s) => new Date(s.startTime) > now && !isSameDay(new Date(s.startTime), today))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;

    // Find the active plan and active block
    const activePlan = plans[0] ?? null;
    let activePlanSummary: {
      id: string;
      name: string;
      blockIndex: number;
      totalBlocks: number;
      activeBlockName: string;
      totalAssignments: number;
      completedAssignments: number;
    } | null = null;

    if (activePlan) {
      const sortedBlocks = [...activePlan.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
      const activeBlockIdx = sortedBlocks.findIndex((b) =>
        b.assignments.some((a) => a.status === "STARTED" || a.status === "OUTSTANDING")
      );
      const activeBlock = sortedBlocks[activeBlockIdx >= 0 ? activeBlockIdx : 0] ?? null;
      const allAssignments = sortedBlocks.flatMap((b) => b.assignments);
      const completedAssignments = allAssignments.filter(
        (a) => a.status === "FINISHED" || a.status === "REVIEWED"
      ).length;

      activePlanSummary = {
        id: activePlan.id,
        name: activePlan.name,
        blockIndex: activeBlockIdx >= 0 ? activeBlockIdx + 1 : 1,
        totalBlocks: sortedBlocks.length,
        activeBlockName: activeBlock?.name ?? "",
        totalAssignments: allAssignments.length,
        completedAssignments,
      };
    }

    // Outstanding flexible tasks (from plan assignments)
    const flexibleTasks = plans
      .flatMap((p) =>
        p.blocks.flatMap((b) =>
          b.assignments
            .filter((a) => a.status === "OUTSTANDING" || a.status === "STARTED")
            .map((a) => ({
              id: a.id,
              name: a.lesson.name,
              focusArea: a.lesson.focusArea,
              priority: a.priority,
              status: a.status,
              durationMinutes: a.lesson.durationMinutes,
            }))
        )
      )
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      })
      .slice(0, 8);

    return NextResponse.json({
      todaySlots,
      nextSlot,
      activePlanSummary,
      flexibleTasks,
      todayCount: todaySlots.length,
    });
  } catch (err) {
    console.error("[/api/dashboard/player GET]", err);
    return NextResponse.json(
      { todaySlots: [], nextSlot: null, activePlanSummary: null, flexibleTasks: [], todayCount: 0 },
      { status: 500 }
    );
  }
}
