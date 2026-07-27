"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Users } from "lucide-react";
import PlayerHomeDashboard from "@/components/PlayerHomeDashboard";

type Team = {
  id: string;
  shortName: string;
  updatedAt?: string;
  createdAt?: string;
};

const DEFAULT_PLAYER_ID = "local-player";

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>(DEFAULT_PLAYER_ID);
  const [playerFirstName, setPlayerFirstName] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerCount, setPlayerCount] = useState<number>(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((me) => {
        if (me?.role) setRole(me.role);
        if (me?.id) setPlayerId(String(me.id));
        if (me?.firstName) setPlayerFirstName(me.firstName);
      });
  }, []);

  useEffect(() => {
    if (!role) return;
    if (role === "COACH" || role === "ADMIN") {
      Promise.all([
        fetch("/api/teams").then((r) => r.ok ? r.json() : []),
        fetch("/api/players/my").then((r) => r.ok ? r.json() : []),
      ]).then(([t, p]) => {
        setTeams(Array.isArray(t) ? t : []);
        setPlayerCount(Array.isArray(p) ? p.length : 0);
      }).catch(() => {});
    }
  }, [role]);

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";

  return (
    <div className="space-y-6 px-0">

      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--golf-heading)]">
          Dashboard
        </h1>
      </header>

      {/* Role-specific tiles */}
      {isCoachOrAdmin && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Teams/Players tile – double-click navigates to /teams */}
          <Card
            className="shadow-sm hover:shadow-md transition-all border border-[var(--golf-muted)] cursor-pointer select-none"
            onClick={() => router.push("/teams")}
            onDoubleClick={() => router.push("/teams")}
            title="Click to open Teams/Players"
          >
            <CardHeader>
              <CardTitle className="text-sm text-[var(--golf-muted-text)]">
                Teams / Players
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-row gap-6">
              <div className="flex items-center gap-2 text-2xl font-semibold text-[var(--golf-heading)]">
                <Users className="h-5 w-5 text-[var(--golf-primary)]" />
                <span>{teams.length}</span>
              </div>
              <div className="flex items-center gap-2 text-2xl font-semibold text-[var(--golf-heading)]">
                <User className="h-5 w-5 text-[var(--golf-primary)]" />
                <span>{playerCount}</span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Player dashboard */}
      {role === "PLAYER" && (
        <section>
          <PlayerHomeDashboard
            firstName={playerFirstName}
            playerId={playerId}
          />
        </section>
      )}

      {/* SysAdmin dashboard */}
      {role === "SYSADMIN" && (
        <section className="space-y-3">
          <p className="text-sm text-[var(--golf-muted-text)]">
            System administration overview. Use Settings to manage clubs and users.
          </p>
        </section>
      )}

    </div>
  );
}
