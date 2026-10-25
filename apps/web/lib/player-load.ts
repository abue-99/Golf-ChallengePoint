"use client";

import { useSyncExternalStore } from "react";

/** Training load of a player across all coaches (coach home). */

export type LoadKind = "training" | "event" | "session" | "lesson";

export type LoadWeek = {
  start: string;
  end: string;
  minutes: number;
  byKind: Record<LoadKind, number>;
  byCoach: { coachId: string | null; name: string; minutes: number }[];
  tournamentDays: number;
  level: "ok" | "high" | "over";
};

export type PlayerLoad = {
  playerId: string;
  limit: number;
  customLimit: number | null;
  weeks: LoadWeek[];
  duplicates: {
    lessonId: string;
    lessonName: string;
    coachIds: string[];
    coaches: string[];
  }[];
  otherCoachLessons: { lessonId: string; coach: string }[];
};

export type LoadResponse = {
  timeZone: string;
  defaultLimit: number;
  players: PlayerLoad[];
};

export const KIND_LABEL: Record<LoadKind, string> = {
  training: "Team trainings",
  event: "Team events",
  session: "Sessions",
  lesson: "Lessons",
};

/** 450 → "7 h 30", 45 → "45 min". */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

// One shared copy for the coach home rows and the player panel.
let cache: LoadResponse | null = null;
let pending: Promise<LoadResponse | null> | null = null;
const listeners = new Set<() => void>();

async function fetchLoad() {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    tz = "";
  }
  const res = await fetch(
    `/api/coach/roster/load${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as LoadResponse;
}

/** Reloads the load (after assigning, planning …) and informs all users. */
export function refreshPlayerLoad() {
  pending = fetchLoad()
    .catch(() => null)
    .then((data) => {
      cache = data;
      pending = null;
      listeners.forEach((listener) => listener());
      return data;
    });
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!cache && !pending) void refreshPlayerLoad();
  return () => {
    listeners.delete(listener);
  };
}

export function usePlayerLoad() {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => null,
  );
}

export async function setLoadLimit(playerId: string, minutes: number | null) {
  const res = await fetch(
    `/api/coach/roster/players/${encodeURIComponent(playerId)}/load-limit`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    },
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "The limit could not be saved.",
    );
  }
  await refreshPlayerLoad();
}

/** Short warning for the row indicator, or null. */
export function loadWarning(load: PlayerLoad | undefined) {
  if (!load) return null;
  const week = load.weeks[0];
  const next = load.weeks[1];
  if (week?.level === "over") {
    return {
      tone: "rose" as const,
      text: `${formatMinutes(week.minutes)} this week – above the limit of ${formatMinutes(load.limit)}`,
    };
  }
  if (next?.level === "over") {
    return {
      tone: "amber" as const,
      text: `${formatMinutes(next.minutes)} next week – above the limit of ${formatMinutes(load.limit)}`,
    };
  }
  if (load.duplicates.length > 0) {
    return {
      tone: "amber" as const,
      text: `Same lesson from two coaches: ${load.duplicates.map((d) => d.lessonName).join(", ")}`,
    };
  }
  if (week?.level === "high") {
    return {
      tone: "amber" as const,
      text: `${formatMinutes(week.minutes)} this week – close to the limit of ${formatMinutes(load.limit)}`,
    };
  }
  return null;
}
