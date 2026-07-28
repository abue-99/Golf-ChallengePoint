import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";
import Link from "next/link";
import { Zap } from "lucide-react";
import PlayerCalendarView from "@/components/PlayerCalendarView";

async function getCurrentUser(token: string) {
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your practice slots
          {user.country ? ` · ${user.country}` : ""}
        </p>
      </header>

      {/* Prominent Training Windows callout */}
      <Link
        href="/training-windows"
        className="flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 hover:bg-green-100 transition-colors group"
      >
        <div className="rounded-xl bg-green-600 p-2 group-hover:bg-green-700 transition-colors">
          <Zap size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Switch to Training Windows</p>
          <p className="text-xs text-green-700">
            The new planning experience — define your availability and let your coach build your plan.
          </p>
        </div>
        <span className="text-green-600 font-medium text-xs">Open →</span>
      </Link>

      <PlayerCalendarView userId={user.id} country={user.country ?? null} />
    </div>
  );
}
