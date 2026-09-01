import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyJwt } from "@/lib/jwt";
import PlayerCalendarView from "@/components/PlayerCalendarView";

type CurrentUser = {
  id: string;
  role: string;
  country?: string | null;
  timezone?: string | null;
  firstName?: string | null;
};

async function getCurrentUser(token: string): Promise<CurrentUser | null> {
  const apiUrl = process.env.API_URL || "http://golf_api:4000";
  const res = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function CalendarPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;
  if (!token) redirect("/api/auth/logout");

  const payload = verifyJwt<{ sub: string }>(token);
  if (!payload) redirect("/api/auth/logout");

  const user = await getCurrentUser(token);
  if (!user) redirect("/api/auth/logout");

  const editable = user.role === "PLAYER" || user.role === "COACH";

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Unified scheduling for practice, missions, events, tournaments,
          milestones, and unavailable periods.
        </p>
      </header>

      {user.role === "ADMIN" ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Admins can review their personal schedule here, while player-specific
          assignment workflows remain available from the coach dashboard.
          <Link
            href="/coach"
            className="ml-2 font-semibold underline underline-offset-2"
          >
            Open coach dashboard
          </Link>
        </div>
      ) : null}

      {user.role === "COACH" ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          You can add your own unavailability here and compare with a selected
          player from the coach player calendar.
          <Link
            href="/coach/players"
            className="ml-2 font-semibold underline underline-offset-2"
          >
            Open player list
          </Link>
        </div>
      ) : null}

      <PlayerCalendarView
        userId={user.id}
        country={user.country ?? null}
        timeZone={user.timezone ?? null}
        editable={editable}
        role={user.role}
      />
    </div>
  );
}
