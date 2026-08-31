"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, User, Users } from "lucide-react";
import Link from "next/link";
import PlayerHomeDashboard from "@/components/PlayerHomeDashboard";
import type { CalendarActivity as BaseCalendarActivity } from "@/types/calendar";

type Team = {
  id: string;
  shortName: string;
  updatedAt?: string;
  createdAt?: string;
};

type CalendarActivity = Pick<
  BaseCalendarActivity,
  "id" | "title" | "start" | "end"
>;

const DEFAULT_PLAYER_ID = "local-player";

function formatScheduleTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>(DEFAULT_PLAYER_ID);
  const [playerFirstName, setPlayerFirstName] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [coachCalendarActivities, setCoachCalendarActivities] = useState<
    CalendarActivity[]
  >([]);
  const [coachNowIso, setCoachNowIso] = useState<string>(() =>
    new Date().toISOString(),
  );

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

  useEffect(() => {
    if (role !== "COACH" || !playerId || playerId === DEFAULT_PLAYER_ID) return;
    fetch(`/api/calendar/player/${playerId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setCoachCalendarActivities(
          Array.isArray(data?.activities) ? data.activities : [],
        );
        setCoachNowIso(new Date().toISOString());
      })
      .catch(() => {
        setCoachCalendarActivities([]);
        setCoachNowIso(new Date().toISOString());
      });
  }, [role, playerId]);

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";
  const coachNowMs = new Date(coachNowIso).getTime();
  const upcomingCoachItems = coachCalendarActivities
    .filter((activity) => new Date(activity.end).getTime() >= coachNowMs)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const coachNextUp = upcomingCoachItems[0] ?? null;

  return (
    <div className="space-y-6 px-0">
      {role !== "PLAYER" ? (
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--golf-heading)]">
            Dashboard
          </h1>
        </header>
      ) : null}

      {role === "COACH" ? (
        <Link href="/calendar">
          <Card className="border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Next Up
                    </p>
                    <p className="font-semibold text-slate-700">
                      {coachNextUp ? coachNextUp.title : "No scheduled items"}
                    </p>
                    {coachNextUp ? (
                      <p className="text-xs text-slate-500">
                        {formatScheduleTime(coachNextUp.start)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-700">
                  Open Calendar
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ) : null}

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
