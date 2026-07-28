import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CoachPlanningBoard from "@/components/CoachPlanningBoard";

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

export default async function CoachPlanningPage({
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
          Planning Board — {playerName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Drag lessons onto training windows to build the player&apos;s training plan
          {player?.country ? ` · ${player.country}` : ""}
        </p>
      </header>
      <CoachPlanningBoard playerId={playerId} />
    </div>
  );
}
