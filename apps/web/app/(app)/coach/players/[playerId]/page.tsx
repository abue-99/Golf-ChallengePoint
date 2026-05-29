import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PlayerCapabilitiesWidget } from "@/components/player-capabilities-widget";

type LinkedPlayer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  country?: string | null;
};

async function getPlayer(token: string, playerId: string): Promise<LinkedPlayer | null> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return null;
  const res = await fetch(`${apiUrl}/users/me/players`, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const players = (await res.json().catch(() => [])) as LinkedPlayer[];
  return players.find((player) => player.id === playerId) ?? null;
}

export default async function CoachPlayerDashboardPage({
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
    ? `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() || player.id
    : playerId;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Player Dashboard — {playerName}</h1>
        <p className="text-sm text-muted-foreground">
          Full player overview
          {player?.country ? ` · ${player.country}` : ""}
        </p>
      </header>
      <PlayerCapabilitiesWidget playerId={playerId} />
    </section>
  );
}
