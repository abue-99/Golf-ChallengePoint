import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import CoachPlayerCard from "@/components/coach-game/CoachPlayerCard";
import ActivityFeed from "@/components/coach-game/ActivityFeed";
import { DevelopmentPlanManager } from "@/components/DevelopmentPlanManager";

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
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Player Dashboard — {playerName}</h1>
          <p className="text-sm text-muted-foreground">
            Full player overview
            {player?.country ? ` · ${player.country}` : ""}
          </p>
          <Link
            href={`/coach/players/${playerId}/calendar`}
            className="mt-2 inline-block text-sm font-semibold text-blue-700 underline underline-offset-2"
          >
            Open calendar comparison
          </Link>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <CoachPlayerCard playerId={playerId} showList />
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-base font-semibold text-[var(--golf-heading)]">Recent activity</h2>
            <ActivityFeed playerId={playerId} compact limit={10} />
          </section>
        </div>
        <div className="lg:col-span-2">
          <DevelopmentPlanManager playerId={playerId} />
        </div>
      </div>
    </section>
  );
}
