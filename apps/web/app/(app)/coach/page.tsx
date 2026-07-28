"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarDays, Route, Search, Users } from "lucide-react";

type Team = {
  id: string;
  shortName: string;
  icon?: string | null;
  members?: { userId: string }[];
};

type Player = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  profileImage?: string | null;
};

type ItemCount = {
  plans: number;
  windows: number;
};

function nameOfPlayer(player: Player) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ") || player.email || "—";
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function hasItems(count?: ItemCount) {
  return Boolean(count && (count.plans > 0 || count.windows > 0));
}

export default function CoachHome() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerCounts, setPlayerCounts] = useState<Record<string, ItemCount>>({});
  const [teamCounts, setTeamCounts] = useState<Record<string, ItemCount>>({});

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const [playersRes, teamsRes] = await Promise.all([
          fetch("/api/players/my", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
          fetch("/api/teams", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
        ]);

        if (ignore) return;

        const nextPlayers = Array.isArray(playersRes) ? playersRes : [];
        const nextTeams = Array.isArray(teamsRes) ? teamsRes : [];
        setPlayers(nextPlayers);
        setTeams(nextTeams);

        const [playerEntries, teamEntries] = await Promise.all([
          Promise.all(
            nextPlayers.map(async (player: Player) => {
              const [plans, calendar] = await Promise.all([
                fetch(`/api/development-plans/player/${player.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
                fetch(`/api/calendar/player/${player.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { slots: [] })),
              ]);
              return [
                player.id,
                {
                  plans: Array.isArray(plans) ? plans.length : 0,
                  windows: Array.isArray(calendar?.slots) ? calendar.slots.length : 0,
                },
              ] as const;
            })
          ),
          Promise.all(
            nextTeams.map(async (team: Team) => {
              const [plans, windows] = await Promise.all([
                fetch(`/api/development-plans/team/${team.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
                fetch(`/api/calendar/team-slots/${team.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
              ]);
              return [
                team.id,
                {
                  plans: Array.isArray(plans) ? plans.length : 0,
                  windows: Array.isArray(windows) ? windows.length : 0,
                },
              ] as const;
            })
          ),
        ]);

        if (ignore) return;
        setPlayerCounts(Object.fromEntries(playerEntries));
        setTeamCounts(Object.fromEntries(teamEntries));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const visiblePlayers = useMemo(
    () =>
      players.filter((player) => {
        if (!hasItems(playerCounts[player.id])) return false;
        if (!normalizedQuery) return true;
        return nameOfPlayer(player).toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, playerCounts, players]
  );

  const visibleTeams = useMemo(
    () =>
      teams.filter((team) => {
        if (!hasItems(teamCounts[team.id])) return false;
        if (!normalizedQuery) return true;
        return team.shortName.toLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, teamCounts, teams]
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coach Dashboard</h1>
          <p className="text-sm text-slate-500">
            Teams und Spieler mit aktuellem Development Plan oder Trainingsfenster.
          </p>
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche Teams oder Spieler…"
            className="pl-9"
          />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Teams"
          icon={<Users className="h-4 w-4 text-emerald-600" />}
          value={visibleTeams.length}
          loading={loading}
        />
        <SummaryCard
          title="Spieler"
          icon={<Route className="h-4 w-4 text-blue-600" />}
          value={visiblePlayers.length}
          loading={loading}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Teams</h2>
        {loading ? (
          <SkeletonGrid />
        ) : visibleTeams.length === 0 ? (
          <EmptyState text="Keine Teams mit aktuellem Development Plan oder Trainingsfenster." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleTeams.map((team) => (
              <Link key={team.id} href="/teams">
                <Card className="h-full border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-emerald-100 text-xl text-emerald-700">
                        {team.icon || initials(team.shortName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-800">{team.shortName}</p>
                      <CountsBadge counts={teamCounts[team.id]} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Spieler</h2>
        {loading ? (
          <SkeletonGrid />
        ) : visiblePlayers.length === 0 ? (
          <EmptyState text="Keine Spieler mit aktuellem Development Plan oder Trainingsfenster." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visiblePlayers.map((player) => {
              const name = nameOfPlayer(player);
              return (
                <Link key={player.id} href={`/coach/players/${player.id}`}>
                  <Card className="h-full border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                      <Avatar className="h-16 w-16">
                        {player.profileImage ? <AvatarImage src={player.profileImage} alt={name} /> : null}
                        <AvatarFallback className="bg-blue-100 text-xl text-blue-700">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-800">{name}</p>
                        <CountsBadge counts={playerCounts[player.id]} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  value,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  value: number;
  loading: boolean;
}) {
  return (
    <Card className="border border-gray-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-500">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-slate-900">{loading ? "…" : value}</div>
      </CardContent>
    </Card>
  );
}

function CountsBadge({ counts }: { counts?: ItemCount }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
        <Route className="h-3 w-3" />
        {counts?.plans ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
        <CalendarDays className="h-3 w-3" />
        {counts?.windows ?? 0}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border border-dashed">
      <CardContent className="p-8 text-center text-sm text-slate-500">{text}</CardContent>
    </Card>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index} className="border border-gray-200 bg-white">
          <CardContent className="flex flex-col items-center gap-3 p-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
