"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types (mirror apps/api/src/game) ─────────────────────────────────

export type Person = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage?: string | null;
};

export type LevelInfo = {
  xp: number;
  level: number;
  levelStartXp: number;
  nextLevelXp: number;
  progress: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "ELITE";
};

export type WeekInfo = {
  goal: number;
  week: string;
  thisWeekDays: string[];
  reachedThisWeek: boolean;
  weekStreak: number;
  bestWeekStreak: number;
  freezes: number;
  history: {
    week: string;
    result: "reached" | "protected" | "frozen" | "missed";
    days: number;
  }[];
};

export type Attribute = {
  area: string;
  label: string;
  score: number | null;
  completed: number;
  samples: number;
};

export type PlayerCard = {
  ovr: number | null;
  attributes: Attribute[];
  tier: LevelInfo["tier"];
  history: {
    key: string;
    label: string;
    ovr: number | null;
    attributes: Attribute[];
  }[];
};

export type Badge = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  value: number;
  target: number;
  earned: boolean;
  earnedAt: string | null;
};

export type Quest = {
  key: string;
  title: string;
  emoji: string;
  value: number;
  target: number;
  done: boolean;
  xp: number;
};

export type GameEvent = {
  id: string;
  type: string;
  title: string | null;
  xp: number;
  createdAt: string;
  meta?: Record<string, unknown> | null;
  actor?: { firstName: string | null; lastName: string | null } | null;
};

export type GameMe = {
  player: {
    firstName: string | null;
    lastName: string | null;
    profileImage: string | null;
    handicap: number | null;
  };
  today: string;
  timeZone: string;
  level: LevelInfo;
  week: WeekInfo;
  card: PlayerCard;
  badges: Badge[];
  quests: Quest[];
  newReviews: number;
  recent: GameEvent[];
};

export type MissionReview = {
  rating: number;
  comment: string | null;
  pick: boolean;
  at: string | null;
  by: Person | null;
  seen: boolean;
};

export type Mission = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "ACTIVE" | "COMPLETED";
  locked: boolean;
  isTeam: boolean;
  team: { id: string; shortName: string; icon: string | null } | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  inQueue: boolean;
  scheduledAt: string | null;
  selfAssessment: number | null;
  playerNotes: string | null;
  stars: number | null;
  resultScore: number | null;
  practiceMinutes: number | null;
  exercisesDone: number[];
  lesson: {
    id: string;
    name: string;
    description: string | null;
    focusArea: string;
    subCapability: string | null;
    durationMinutes: number;
    location: string | null;
    videoUrl: string | null;
    trainingObjective: string | null;
    successCriteria: string | null;
    plannedExercises: string | null;
    targetScore: number | null;
    targetAttempts: number | null;
    exercises: string[];
    coach: Person;
  };
  coach: Person;
  review: MissionReview | null;
  journeyName?: string | null;
};

export type JourneyPath = {
  planId: string;
  journeyAssignmentId: string | null;
  name: string;
  description: string | null;
  coach: Person;
  team: { id: string; shortName: string; icon: string | null } | null;
  total: number;
  done: number;
  blocks: {
    id: string;
    name: string;
    goal: string | null;
    missions: Mission[];
  }[];
};

export type GamePath = {
  inbox: {
    journeys: {
      id: string;
      name: string;
      description: string | null;
      lessonCount: number;
      coach: Person;
      team: { id: string; shortName: string; icon: string | null } | null;
      createdAt: string;
    }[];
    missions: Mission[];
  };
  journeys: JourneyPath[];
  side: Mission[];
  next: Mission | null;
  upNext: Mission[];
};

export type GameOutcome = {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: { key: string; title: string; emoji: string }[];
  questsDone: string[];
  weekGoalReached: boolean;
  events: { type: string; title: string | null; xp: number }[];
};

export type CompleteResult = {
  mission: Mission;
  stars: number;
  unlocked: { id: string; name: string } | null;
  outcome: GameOutcome;
};

export type LeagueRow = {
  playerId: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  xp: number;
  rank: number;
  me: boolean;
};

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  focusArea: string | null;
  unit: string;
  higherIsBetter: boolean;
  targetScore: number | null;
  isBenchmark: boolean;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "active" | "ended";
  team: { id: string; shortName: string; icon: string | null };
  coach: Person;
  leaderboard: {
    rank: number;
    player: Person;
    score: number;
    attempts: number;
    me?: boolean;
  }[];
  mine?: { rank: number; score: number; attempts: number } | null;
  participants?: number;
};

export type TeamFeedItem = {
  id: string;
  type: string;
  title: string | null;
  xp: number;
  createdAt: string;
  player: Person;
  mine: boolean;
  stars: number | null;
  focusArea: string | null;
  best: number | null;
  unit: string | null;
  kudos: number;
  kudosFrom: string[];
  gaveKudos: boolean;
};

export type GameTeam = {
  week: string;
  leagues: {
    team: { id: string; shortName: string; icon: string | null };
    week: string;
    ranking: LeagueRow[];
  }[];
  feed: TeamFeedItem[];
  challenges: Challenge[];
};

// ── Fetch helpers ──────────────────────────────────────────────────

async function call<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/game${path}`, {
    cache: "no-store",
    ...rest,
    ...(json !== undefined
      ? {
          body: JSON.stringify(json),
          headers: {
            "Content-Type": "application/json",
            ...(rest.headers ?? {}),
          },
        }
      : {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

export const gameApi = {
  me: () => call<GameMe>(`/me?tz=${encodeURIComponent(browserTimeZone())}`),
  setGoal: (days: number) =>
    call<{ weeklyGoalDays: number }>("/me/goal", {
      method: "PATCH",
      json: { days },
    }),
  path: () => call<GamePath>("/path"),
  accept: (body: {
    all?: boolean;
    journeyIds?: string[];
    missionIds?: string[];
  }) =>
    call<{ journeys: number; missions: number; outcome: GameOutcome }>(
      "/inbox/accept",
      {
        method: "POST",
        json: body,
      },
    ),
  mission: (id: string) => call<Mission>(`/missions/${encodeURIComponent(id)}`),
  start: (id: string) =>
    call<Mission>(`/missions/${encodeURIComponent(id)}/start`, {
      method: "POST",
      json: {},
    }),
  complete: (
    id: string,
    body: {
      resultScore?: number | null;
      practiceMinutes?: number | null;
      exercisesDone?: number[];
      selfAssessment?: number | null;
      playerNotes?: string | null;
    },
  ) =>
    call<CompleteResult>(`/missions/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      json: body,
    }),
  reviews: () => call<Mission[]>("/reviews"),
  reviewsSeen: (assignmentId?: string) =>
    call<{ updated: number }>("/reviews/seen", {
      method: "POST",
      json: assignmentId ? { assignmentId } : {},
    }),
  team: () =>
    call<GameTeam>(`/team?tz=${encodeURIComponent(browserTimeZone())}`),
  kudos: (eventId: string) =>
    call<{ eventId: string; kudos: number; gaveKudos: boolean }>(
      `/kudos/${encodeURIComponent(eventId)}`,
      {
        method: "POST",
        json: {},
      },
    ),
  enterChallenge: (id: string, score: number, note?: string) =>
    call<{ outcome: GameOutcome }>(
      `/challenges/${encodeURIComponent(id)}/entries`,
      {
        method: "POST",
        json: { score, note },
      },
    ),
};

// ── Refresh bus: screens reload after a mission or answer ───────────

const listeners = new Set<() => void>();

export function emitGameChanged() {
  for (const listener of listeners) listener();
}

export function onGameChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Loads data with a loader and reloads on `emitGameChanged()`. */
export function useGameData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      const next = await loader();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void reload();
    return onGameChanged(() => void reload());
  }, [reload]);
  return { data, error, loading, reload, setData };
}

// ── Display helpers ─────────────────────────────────────────────────

export const FOCUS_META: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  SETUP: { label: "Setup", emoji: "📐", color: "#0ea5e9" },
  PUTTING: { label: "Putting", emoji: "⛳", color: "#16a34a" },
  SHORT_GAME: { label: "Short Game", emoji: "🎯", color: "#f59e0b" },
  LONG_GAME: { label: "Long Game", emoji: "🚀", color: "#6366f1" },
  TACTICAL: { label: "Tactics", emoji: "🧠", color: "#a855f7" },
  FITNESS: { label: "Fitness", emoji: "🏋️", color: "#ef4444" },
  MENTAL: { label: "Mental", emoji: "🧘", color: "#14b8a6" },
};

export function focusMeta(area: string | null | undefined) {
  return (
    (area && FOCUS_META[area]) || {
      label: area ?? "Mission",
      emoji: "🎯",
      color: "#64748b",
    }
  );
}

export const TIER_STYLE: Record<
  LevelInfo["tier"],
  { label: string; card: string; text: string; ring: string }
> = {
  BRONZE: {
    label: "Bronze",
    card: "from-amber-700 via-orange-600 to-amber-800",
    text: "text-amber-50",
    ring: "#f59e0b",
  },
  SILVER: {
    label: "Silver",
    card: "from-slate-400 via-slate-200 to-slate-500",
    text: "text-slate-900",
    ring: "#cbd5e1",
  },
  GOLD: {
    label: "Gold",
    card: "from-yellow-500 via-amber-300 to-yellow-600",
    text: "text-yellow-950",
    ring: "#facc15",
  },
  ELITE: {
    label: "Elite",
    card: "from-emerald-900 via-teal-700 to-slate-900",
    text: "text-emerald-50",
    ring: "#34d399",
  },
};

export function personName(
  person:
    | { firstName: string | null; lastName: string | null }
    | null
    | undefined,
) {
  if (!person) return "";
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function initials(
  person:
    | { firstName: string | null; lastName: string | null }
    | null
    | undefined,
) {
  const value =
    `${person?.firstName?.[0] ?? ""}${person?.lastName?.[0] ?? ""}`.toUpperCase();
  return value || "?";
}

export function timeAgo(value: string | Date, now = Date.now()) {
  const diff = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Feelings for the self-assessment (stored 1–10). */
export const FEELINGS = [
  { value: 2, emoji: "😣", label: "Tough" },
  { value: 4, emoji: "😕", label: "Meh" },
  { value: 6, emoji: "🙂", label: "OK" },
  { value: 8, emoji: "😃", label: "Good" },
  { value: 10, emoji: "🤩", label: "Great" },
];

export function eventText(event: { type: string; title: string | null }) {
  const title = event.title ?? "";
  switch (event.type) {
    case "LESSON_COMPLETED":
      return `Completed ${title}`;
    case "LESSON_STARTED":
      return `Started ${title}`;
    case "BLOCK_COMPLETED":
      return `Finished block ${title}`;
    case "JOURNEY_COMPLETED":
      return `Finished the journey ${title}`;
    case "JOURNEY_ACCEPTED":
      return `Accepted the journey ${title}`;
    case "SESSION_COMPLETED":
      return `Practised: ${title}`;
    case "TEAM_SESSION":
      return `Team session: ${title}`;
    case "ATTENDANCE_ANSWERED":
      return `Answered: ${title}`;
    case "QUESTION_ANSWERED":
      return "Answered a coach question";
    case "COACH_REVIEW":
      return `Coach review: ${title}`;
    case "CHALLENGE_ENTRY":
      return `Challenge: ${title}`;
    case "QUEST_COMPLETED":
      return `Quest done: ${title}`;
    case "WEEK_GOAL":
      return "Weekly goal reached";
    case "BADGE_EARNED":
      return `New badge ${title}`;
    case "LEVEL_UP":
      return title;
    case "LEAGUE_PODIUM":
      return title;
    default:
      return title;
  }
}
