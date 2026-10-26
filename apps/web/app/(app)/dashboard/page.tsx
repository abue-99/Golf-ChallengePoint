"use client";

import { Suspense, useEffect, useState } from "react";
import PlayerHome from "@/components/game/PlayerHome";
import CoachRoster from "@/components/CoachRoster";
import { resolveCalendarTimeZone } from "@/lib/timezone";

const DEFAULT_PLAYER_ID = "local-player";

export default function Dashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>(DEFAULT_PLAYER_ID);
  const [playerFirstName, setPlayerFirstName] = useState<string>("");
  const [viewerTimeZone, setViewerTimeZone] = useState<string>("local");

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

  const isCoachOrAdmin = role === "COACH" || role === "ADMIN";

  return (
    <div className="space-y-5 px-0">
      {isCoachOrAdmin ? <CoachRoster firstName={playerFirstName} /> : null}

      {/* Player dashboard */}
      {role === "PLAYER" && (
        <Suspense fallback={null}>
          <PlayerHome playerId={playerId} timeZone={viewerTimeZone} />
        </Suspense>
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
