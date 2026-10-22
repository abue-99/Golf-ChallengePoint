"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import PlayerHomeDashboard from "@/components/PlayerHomeDashboard";
import NewAssignmentsSection from "@/components/NewAssignmentsSection";
import CoachRoster from "@/components/CoachRoster";
import type { CalendarActivity as BaseCalendarActivity } from "@/types/calendar";
import { formatDateInTimeZone, resolveCalendarTimeZone } from "@/lib/timezone";

type CalendarActivity = Pick<
  BaseCalendarActivity,
  "id" | "title" | "start" | "end"
>;

const DEFAULT_PLAYER_ID = "local-player";

function formatNextUp(value: string, timeZone: string) {
  return formatDateInTimeZone(value, timeZone, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function Dashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>(DEFAULT_PLAYER_ID);
  const [playerFirstName, setPlayerFirstName] = useState<string>("");
  const [viewerTimeZone, setViewerTimeZone] = useState<string>("local");
  const [nextUp, setNextUp] = useState<CalendarActivity | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.role) setRole(me.role);
        if (me?.id) setPlayerId(String(me.id));
        if (me?.firstName) setPlayerFirstName(me.firstName);
        setViewerTimeZone(resolveCalendarTimeZone(me?.timezone));
      });
  }, []);

  useEffect(() => {
    if (role !== "COACH" || !playerId || playerId === DEFAULT_PLAYER_ID) return;
    fetch(`/api/calendar/player/${playerId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const activities: CalendarActivity[] = Array.isArray(data?.activities)
          ? data.activities
          : [];
        const nowMs = Date.now();
        const upcoming = activities
          .filter((activity) => new Date(activity.end).getTime() >= nowMs)
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        setNextUp(upcoming[0] ?? null);
      })
      .catch(() => setNextUp(null));
  }, [role, playerId]);

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";

  return (
    <div className="space-y-5 px-0">
      {isCoachOrAdmin ? (
        <>
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--golf-heading)]">
              My Players
            </h1>
            {role === "COACH" ? (
              <Link
                href="/calendar"
                className="inline-flex min-w-0 items-center gap-2 text-sm text-slate-600 hover:text-[var(--golf-primary)]"
              >
                <CalendarDays className="h-4 w-4 shrink-0 text-[var(--golf-primary)]" />
                {nextUp ? (
                  <span className="truncate">
                    <span className="text-slate-400">Next up:</span>{" "}
                    <span className="font-medium text-slate-700">{nextUp.title}</span>{" "}
                    · {formatNextUp(nextUp.start, viewerTimeZone)}
                  </span>
                ) : (
                  <span>Nothing scheduled · Open calendar</span>
                )}
              </Link>
            ) : null}
          </header>
          <CoachRoster />
        </>
      ) : null}

      {/* Player dashboard */}
      {role === "PLAYER" && (
        <section className="space-y-6">
          <NewAssignmentsSection />
          <PlayerHomeDashboard
            firstName={playerFirstName}
            playerId={playerId}
            timeZone={viewerTimeZone}
          />
        </section>
      )}

      {/* SysAdmin dashboard */}
      {role === "SYSADMIN" && (
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--golf-heading)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--golf-muted-text)]">
            System administration overview. Use Settings to manage clubs and users.
          </p>
        </section>
      )}
    </div>
  );
}
