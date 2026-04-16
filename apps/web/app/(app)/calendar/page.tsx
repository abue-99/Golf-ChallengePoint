import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";
import PlayerCalendarView from "@/components/PlayerCalendarView";

async function getCurrentUser(token: string) {
  const apiUrl = process.env.API_URL || "http://golf_api:4000";
  const res = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Manage your practice slots and view coach-assigned tasks
          {user.country ? ` · ${user.country}` : ""}
        </p>
      </header>
      <PlayerCalendarView userId={user.id} country={user.country ?? null} />
    </div>
  );
}
