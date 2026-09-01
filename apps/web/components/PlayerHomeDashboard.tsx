"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { CalendarActivity } from "@/types/calendar";
import {
  FOCUS_AREAS,
  type PlayerDevelopmentPlan,
  type LessonAssignment,
} from "@/lib/lesson-types";
import {
  PlayerCapabilitiesRadarCard,
  PlayerCapabilitiesWidget,
} from "@/components/player-capabilities-widget";
import { cn } from "@/lib/utils";
import {
  Clock,
  ChevronRight,
  Trophy,
  Zap,
  CalendarDays,
  Flame,
} from "lucide-react";

const FOCUS_AREA_EMOJI: Record<string, string> = {
  SETUP: "🏌️",
  PUTTING: "⛳",
  SHORT_GAME: "🎯",
  LONG_GAME: "💪",
  TACTICAL: "🧠",
  FITNESS: "🏃",
  MENTAL: "🧘",
};

const STATUS_NODE: Record<string, { emoji: string; label: string }> = {
  OUTSTANDING: { emoji: "⚪", label: "Open" },
  STARTED: { emoji: "🟡", label: "In Progress" },
  FINISHED: { emoji: "✅", label: "Completed" },
  REVIEWED: { emoji: "⭐", label: "Reviewed" },
};

type GamificationProfile = {
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  levelProgress: number;
  nextLevelXp: number;
};

function formatScheduleTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function findActiveAssignment(plans: PlayerDevelopmentPlan[]): {
  assignment: LessonAssignment;
  planName: string;
  blockName: string;
} | null {
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const started = block.assignments.find((a) => a.status === "STARTED");
      if (started)
        return {
          assignment: started,
          planName: plan.name,
          blockName: block.name,
        };
    }
  }
  // Fall back to first outstanding in first unlocked block
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const outstanding = block.assignments.find(
        (a) => a.status === "OUTSTANDING",
      );
      if (outstanding)
        return {
          assignment: outstanding,
          planName: plan.name,
          blockName: block.name,
        };
    }
  }
  return null;
}

function getActivePlan(
  plans: PlayerDevelopmentPlan[],
): PlayerDevelopmentPlan | null {
  // Find the plan that has at least one started assignment, else first plan
  const withStarted = plans.find((p) =>
    p.blocks.some((b) => b.assignments.some((a) => a.status === "STARTED")),
  );
  return withStarted ?? plans[0] ?? null;
}

// ─── Hero Level Card ──────────────────────────────────────────────────────────

function HeroLevelCard({
  firstName,
  xp,
  level,
  levelProgress,
  nextLevelXp,
  currentStreak,
}: {
  firstName: string;
  xp: number;
  level: number;
  levelProgress: number;
  nextLevelXp: number;
  currentStreak: number;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-700 via-green-800 to-emerald-900 px-5 py-5 text-white shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-green-300">
            Hi {firstName || "Golfer"} 👋
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
            🏌️ Player Development
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-sm font-bold">Level {level}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
            <Flame className="h-3.5 w-3.5 text-orange-300" />
            <span className="text-sm font-bold">
              {currentStreak} Day Streak
            </span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-green-300">
            <Zap className="h-3 w-3" />
            {xp} XP
          </span>
          <span className="text-green-300">
            {levelProgress}% of {nextLevelXp} XP to Level {level + 1}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/20">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-700"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Today's Training Card ────────────────────────────────────────────────────

function TodaysTrainingCard({
  active,
}: {
  active: {
    assignment: LessonAssignment;
    planName: string;
    blockName: string;
  } | null;
}) {
  if (!active) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-center">
        <p className="text-2xl mb-2">🏆</p>
        <p className="font-semibold text-slate-700">All caught up!</p>
        <p className="mt-1 text-sm text-slate-500">
          No pending training. Great work!
        </p>
      </div>
    );
  }

  const { assignment } = active;
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";
  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === assignment.lesson.focusArea)?.label ??
    assignment.lesson.focusArea;
  const statusNode = STATUS_NODE[assignment.status] ?? STATUS_NODE.OUTSTANDING;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
          Today&apos;s Training
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl">{focusEmoji}</span>
            <div>
              <h3 className="font-bold text-slate-800 text-base leading-tight">
                {assignment.lesson.name}
              </h3>
              <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {assignment.lesson.durationMinutes} min
                </span>
                <span>{focusLabel}</span>
                <span>
                  {statusNode.emoji} {statusNode.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {assignment.lesson.trainingObjective && (
          <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 line-clamp-2">
            {assignment.lesson.trainingObjective}
          </p>
        )}

        <Link
          href="/player"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          START NOW
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ─── Current Journey Preview ──────────────────────────────────────────────────

function CurrentJourneyCard({ plan }: { plan: PlayerDevelopmentPlan | null }) {
  if (!plan) return null;

  const allAssignments = plan.blocks.flatMap((b) => b.assignments);
  const total = allAssignments.length;
  const done = allAssignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED",
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Find the active block (first with in-progress or outstanding lessons)
  const activeBlock =
    plan.blocks.find((b) =>
      b.assignments.some(
        (a) => a.status === "STARTED" || a.status === "OUTSTANDING",
      ),
    ) ?? plan.blocks[0];

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Current Journey
        </p>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{plan.name}</h3>
          <span className="text-sm font-semibold text-slate-500">
            {done} of {total}
          </span>
        </div>

        {/* Mini progress bar */}
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Active block lesson list */}
        {activeBlock && (
          <div className="space-y-1.5">
            {activeBlock.assignments.slice(0, 5).map((a, idx) => {
              const node = STATUS_NODE[a.status] ?? STATUS_NODE.OUTSTANDING;
              const prevCompleted =
                idx === 0 ||
                activeBlock.assignments[idx - 1].status === "FINISHED" ||
                activeBlock.assignments[idx - 1].status === "REVIEWED";
              const isLocked = a.status === "OUTSTANDING" && !prevCompleted;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-center gap-2.5 text-sm",
                    isLocked ? "opacity-40" : "",
                  )}
                >
                  <span className="text-base leading-none">
                    {isLocked ? "🔒" : node.emoji}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      a.status === "FINISHED" || a.status === "REVIEWED"
                        ? "text-slate-400 line-through"
                        : "text-slate-700",
                    )}
                  >
                    {a.lesson.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <Link
          href="/player"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          OPEN JOURNEY
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function CalendarSummaryCard({
  activities,
  nowIso,
}: {
  activities: CalendarActivity[];
  nowIso: string;
}) {
  const now = nowIso ? new Date(nowIso).getTime() : 0;
  const today = nowIso ? new Date(nowIso) : new Date(0);
  const upcoming = [...activities]
    .filter((activity) => new Date(activity.end).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const nextUp = upcoming[0] ?? null;
  const todayItems = upcoming
    .filter((activity) => {
      const date = new Date(activity.start);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    })
    .slice(0, 3);

  return (
    <Link href="/calendar" className="block">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-4 hover:shadow-md transition-shadow space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Next Up
              </p>
              <p className="font-semibold text-slate-700">
                {nextUp ? nextUp.title : "No scheduled items"}
              </p>
              {nextUp ? (
                <p className="text-xs text-slate-500">
                  {formatScheduleTime(nextUp.start)}
                </p>
              ) : null}
            </div>
          </div>
          <span className="text-sm font-semibold text-blue-700">Open Calendar</span>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Today&apos;s Schedule
          </p>
          <div className="mt-2 space-y-1.5">
            {todayItems.length === 0 ? (
              <p className="text-sm text-slate-500">No items scheduled today.</p>
            ) : (
              todayItems.map((item) => (
                <div key={item.id} className="text-sm text-slate-600">
                  {formatScheduleTime(item.start)} {item.title}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function WeeklyCompletionCard({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-50">
          Weekly Completion
        </p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Sessions this week</p>
          <p className="text-lg font-bold text-slate-800">
            {completed} / {total}
          </p>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          Sessions you mark complete on your calendar count toward this total.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayerHomeDashboard({
  firstName,
  playerId,
}: {
  firstName: string;
  playerId: string;
}) {
  const [plans, setPlans] = useState<PlayerDevelopmentPlan[]>([]);
  const [gamification, setGamification] = useState<GamificationProfile>({
    xp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    levelProgress: 0,
    nextLevelXp: 100,
  });
  const [weeklyCompletion, setWeeklyCompletion] = useState({
    completed: 0,
    total: 0,
  });
  const [calendarActivities, setCalendarActivities] = useState<CalendarActivity[]>(
    [],
  );
  const [calendarNowIso, setCalendarNowIso] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    try {
      const [data, profile, calendar] = await Promise.all([
        api.getMyPlans(),
        api.getGamificationProfile(playerId),
        api.getPlayerCalendar(playerId),
      ]);
      setPlans(Array.isArray(data) ? data : []);
      if (profile) {
        setGamification({
          xp: profile.xp ?? 0,
          level: profile.level ?? 1,
          currentStreak: profile.currentStreak ?? 0,
          longestStreak: profile.longestStreak ?? 0,
          levelProgress: profile.levelProgress ?? 0,
          nextLevelXp: profile.nextLevelXp ?? 100,
        });
      }
      setWeeklyCompletion(
        calendar?.summary?.weeklyCompletion ?? { completed: 0, total: 0 },
      );
      setCalendarActivities(
        Array.isArray(calendar?.activities) ? calendar.activities : [],
      );
      setCalendarNowIso(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const activeTraining = loading ? null : findActiveAssignment(plans);
  const activePlan = loading ? null : getActivePlan(plans);

  return (
    <div className="mx-auto max-w-lg pb-4 lg:max-w-none">
      {/* Two-column grid on lg+, single column on mobile */}
      <div className="lg:grid lg:gap-6" style={{ gridTemplateColumns: "3fr 2fr" }}>
        {/* Left column */}
        <div className="space-y-6">
          {/* Hero level card */}
          <HeroLevelCard
            firstName={firstName}
            xp={gamification.xp}
            level={gamification.level}
            levelProgress={gamification.levelProgress}
            nextLevelXp={gamification.nextLevelXp}
            currentStreak={gamification.currentStreak}
          />

          {/* Today's training */}
          {loading ? (
            <div className="rounded-2xl bg-slate-100 animate-pulse h-40" />
          ) : (
            <TodaysTrainingCard active={activeTraining} />
          )}

          {/* Current journey preview */}
          {loading ? (
            <div className="rounded-2xl bg-slate-100 animate-pulse h-48" />
          ) : (
            <CurrentJourneyCard plan={activePlan} />
          )}

          {loading ? (
            <div className="rounded-2xl bg-slate-100 animate-pulse h-32" />
          ) : (
            <WeeklyCompletionCard
              completed={weeklyCompletion.completed}
              total={weeklyCompletion.total}
            />
          )}
        </div>

        {/* Right column */}
        <div className="mt-6 space-y-6 lg:mt-0">
          {loading ? (
            <div className="rounded-2xl bg-slate-100 animate-pulse h-36" />
          ) : (
            <CalendarSummaryCard activities={calendarActivities} nowIso={calendarNowIso} />
          )}

          {loading ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="Loading capability data"
              className="rounded-2xl bg-slate-100 animate-pulse h-[360px]"
            />
          ) : (
            <div className="space-y-4">
              <PlayerCapabilitiesWidget playerId={playerId} showRadar={false} />
              <PlayerCapabilitiesRadarCard
                playerId={playerId}
                title="Skill Radar"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
