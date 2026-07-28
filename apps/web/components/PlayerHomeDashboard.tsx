"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  type PlayerDevelopmentPlan,
  type LessonAssignment,
} from "@/lib/lesson-types";
import { PlayerCapabilitiesRadarCard, PlayerCapabilitiesWidget } from "@/components/player-capabilities-widget";
import { cn } from "@/lib/utils";
import { Clock, ChevronRight, Trophy, Zap, CalendarDays } from "lucide-react";

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

function computeXp(plans: PlayerDevelopmentPlan[]): number {
  let xp = 0;
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const blockAssignments = block.assignments;
      const doneCount = blockAssignments.filter(
        (a) => a.status === "FINISHED" || a.status === "REVIEWED"
      ).length;
      xp += doneCount * 50;
      if (doneCount === blockAssignments.length && blockAssignments.length > 0) {
        xp += 500;
      }
    }
  }
  return xp;
}

function xpToLevel(xp: number): { level: number; progress: number; nextLevelXp: number } {
  // Each level requires 500 XP (levels 1–10 then 1000 XP per level)
  let level = 1;
  let threshold = 500;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = level >= 10 ? 1000 : 500;
  }
  return { level, progress: Math.round((remaining / threshold) * 100), nextLevelXp: threshold };
}

function findActiveAssignment(
  plans: PlayerDevelopmentPlan[]
): { assignment: LessonAssignment; planName: string; blockName: string } | null {
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const started = block.assignments.find((a) => a.status === "STARTED");
      if (started) return { assignment: started, planName: plan.name, blockName: block.name };
    }
  }
  // Fall back to first outstanding in first unlocked block
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const outstanding = block.assignments.find((a) => a.status === "OUTSTANDING");
      if (outstanding) return { assignment: outstanding, planName: plan.name, blockName: block.name };
    }
  }
  return null;
}

function getActivePlan(plans: PlayerDevelopmentPlan[]): PlayerDevelopmentPlan | null {
  // Find the plan that has at least one started assignment, else first plan
  const withStarted = plans.find((p) =>
    p.blocks.some((b) => b.assignments.some((a) => a.status === "STARTED"))
  );
  return withStarted ?? plans[0] ?? null;
}

// ─── Hero Level Card ──────────────────────────────────────────────────────────

function HeroLevelCard({
  firstName,
  xp,
}: {
  firstName: string;
  xp: number;
}) {
  const { level, progress } = xpToLevel(xp);

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
        </div>
      </div>

      {/* XP Progress */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-green-300">
            <Zap className="h-3 w-3" />
            {xp} XP
          </span>
          <span className="text-green-300">{progress}% to Level {level + 1}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-white/20">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-700"
            style={{ width: `${progress}%` }}
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
  active: { assignment: LessonAssignment; planName: string; blockName: string } | null;
}) {
  if (!active) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-5 text-center">
        <p className="text-2xl mb-2">🏆</p>
        <p className="font-semibold text-slate-700">All caught up!</p>
        <p className="mt-1 text-sm text-slate-500">No pending training. Great work!</p>
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
                <span>{statusNode.emoji} {statusNode.label}</span>
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
    (a) => a.status === "FINISHED" || a.status === "REVIEWED"
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Find the active block (first with in-progress or outstanding lessons)
  const activeBlock =
    plan.blocks.find((b) =>
      b.assignments.some((a) => a.status === "STARTED" || a.status === "OUTSTANDING")
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
          <span className="text-sm font-semibold text-slate-500">{done} of {total}</span>
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
                    isLocked ? "opacity-40" : ""
                  )}
                >
                  <span className="text-base leading-none">{isLocked ? "🔒" : node.emoji}</span>
                  <span
                    className={cn(
                      "font-medium",
                      a.status === "FINISHED" || a.status === "REVIEWED"
                        ? "text-slate-400 line-through"
                        : "text-slate-700"
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

// ─── Next Coach Session Placeholder ──────────────────────────────────────────

function NextSessionCard() {
  return (
    <Link href="/calendar">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Next Coach Session
            </p>
            <p className="font-semibold text-slate-700">View Calendar</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
    </Link>
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
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    try {
      const data = await api.getMyPlans();
      setPlans(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const xp = computeXp(plans);
  const activeTraining = loading ? null : findActiveAssignment(plans);
  const activePlan = loading ? null : getActivePlan(plans);

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-4">
      {/* Hero level card */}
      <HeroLevelCard firstName={firstName} xp={xp} />

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
        <div role="status" aria-live="polite" aria-label="Loading capability data" className="rounded-2xl bg-slate-100 animate-pulse h-[360px]" />
      ) : (
        <div className="space-y-4">
          <PlayerCapabilitiesWidget playerId={playerId} showRadar={false} />
          <PlayerCapabilitiesRadarCard playerId={playerId} title="Skill Radar" />
        </div>
      )}

      {/* Next coach session */}
      <NextSessionCard />
    </div>
  );
}
