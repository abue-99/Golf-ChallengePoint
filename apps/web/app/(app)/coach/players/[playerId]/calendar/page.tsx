import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import CoachPlayerCalendarView from "@/components/CoachPlayerCalendarView";

async function getPlayer(token: string, playerId: string) {
  const apiUrl = process.env.API_URL || "http://golf_api:4000";
  const res = await fetch(`${apiUrl}/users/me/players`, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const players: any[] = await res.json().catch(() => []);
  return players.find((p: any) => p.id === playerId) ?? null;
}

export default async function CoachPlayerCalendarPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value ?? null;
  if (!token) redirect("/api/auth/logout");

  const { playerId } = await params;
  const player = await getPlayer(token, playerId);

  const playerName = player
    ? `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()
    : playerId;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Calendar — {playerName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Legacy calendar view
          {player?.country ? ` · ${player.country}` : ""}
        </p>
      </header>

      {/* Link to new Planning Board */}
      <Link
        href={`/coach/players/${playerId}/planning`}
        className="flex items-center gap-3 rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 hover:bg-blue-100 transition-colors group"
      >
        <div className="rounded-xl bg-blue-600 p-2 group-hover:bg-blue-700 transition-colors">
          <LayoutTemplate size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Open Planning Board</p>
          <p className="text-xs text-blue-700">
            Drag & drop lessons onto training windows to build this player's training plan.
          </p>
        </div>
        <span className="text-blue-600 font-medium text-xs">Open →</span>
      </Link>

      <CoachPlayerCalendarView playerId={playerId} />
    </div>
  );
}
