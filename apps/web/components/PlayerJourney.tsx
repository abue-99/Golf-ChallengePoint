"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ASSIGNMENT_STATUSES,
  getFocusAreaPath,
  type PlayerDevelopmentPlan,
  type TrainingBlock,
  type LessonAssignment,
} from "@/lib/lesson-types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, ChevronDown, ChevronUp, Star, Zap, Trophy } from "lucide-react";

const FOCUS_AREA_EMOJI: Record<string, string> = {
  SETUP: "🏌️",
  PUTTING: "⛳",
  SHORT_GAME: "🎯",
  LONG_GAME: "💪",
  TACTICAL: "🧠",
  FITNESS: "🏃",
  MENTAL: "🧘",
};

function missionChecklist(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

// ─── Status Configuration ─────────────────────────────────────────────────────

type StatusKey = "OUTSTANDING" | "STARTED" | "FINISHED" | "REVIEWED" | "LOCKED";

const STATUS_STYLE: Record<
  StatusKey,
  { label: string; badge: string; dot: string }
> = {
  OUTSTANDING: {
    label: "Open",
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-300",
  },
  STARTED: {
    label: "In Progress",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  FINISHED: {
    label: "Completed",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
  },
  REVIEWED: {
    label: "Reviewed",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
  },
  LOCKED: {
    label: "Locked",
    badge: "bg-slate-100 text-slate-400",
    dot: "bg-slate-200",
  },
};

function resolveStatus(
  assignment: LessonAssignment,
  isLocked: boolean,
): StatusKey {
  if (isLocked) return "LOCKED";
  return assignment.status as StatusKey;
}

// ─── XP helpers ──────────────────────────────────────────────────────────────

function computeXp(plans: PlayerDevelopmentPlan[]): number {
  let xp = 0;
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const done = block.assignments.filter(
        (a) => a.status === "FINISHED" || a.status === "REVIEWED",
      ).length;
      xp += done * 50;
      if (done === block.assignments.length && block.assignments.length > 0)
        xp += 500;
    }
  }
  return xp;
}

function xpLevel(xp: number): { level: number; progress: number } {
  let level = 1;
  let threshold = 500;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = level >= 10 ? 1000 : 500;
  }
  return { level, progress: Math.round((remaining / threshold) * 100) };
}

// ─── Completion Celebration ───────────────────────────────────────────────────

function CompletionCelebration({
  lessonName,
  onDismiss,
  nextLesson,
}: {
  lessonName: string;
  onDismiss: () => void;
  nextLesson?: string;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-center text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3 animate-bounce">🎉</div>
        <h2 className="text-2xl font-extrabold tracking-tight">
          LESSON COMPLETED
        </h2>
        <p className="mt-1 text-green-200 font-medium">{lessonName}</p>

        <div className="mt-5 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-4 py-3">
            <Zap className="h-5 w-5 text-amber-300" />
            <span className="text-xl font-extrabold">+50 XP</span>
            <span className="text-xs text-green-200">Experience</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-4 py-3">
            <Trophy className="h-5 w-5 text-amber-300" />
            <span className="text-xl font-extrabold">+1</span>
            <span className="text-xs text-green-200">Lesson</span>
          </div>
        </div>

        {nextLesson && (
          <div className="mt-5 rounded-xl bg-white/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-200 mb-1">
              New Lesson Unlocked
            </p>
            <p className="font-bold">{nextLesson}</p>
          </div>
        )}

        <button
          onClick={onDismiss}
          className="mt-5 w-full rounded-2xl bg-white py-3 font-bold text-green-700 hover:bg-green-50 transition-colors"
        >
          CONTINUE JOURNEY
        </button>
      </div>
    </div>
  );
}

// ─── Lesson Card ──────────────────────────────────────────────────────────────

function LessonCard({
  assignment,
  isLocked,
  onTap,
}: {
  assignment: LessonAssignment;
  isLocked: boolean;
  onTap: () => void;
}) {
  const statusKey = resolveStatus(assignment, isLocked);
  const style = STATUS_STYLE[statusKey];
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";
  const focusPath = getFocusAreaPath(
    assignment.lesson.focusArea,
    assignment.lesson.subCapability,
    assignment.lesson.subSubCapability,
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 p-3 transition-all duration-200",
        statusKey === "STARTED" && "border-blue-200 bg-blue-50/60",
        statusKey === "FINISHED" && "border-green-200 bg-green-50/60",
        statusKey === "REVIEWED" && "border-amber-200 bg-amber-50/60",
        statusKey === "OUTSTANDING" && "border-gray-200 bg-white",
        statusKey === "LOCKED" && "border-slate-100 bg-slate-50/60 opacity-60",
        !isLocked && "cursor-pointer hover:shadow-sm active:scale-[0.99]",
      )}
      onClick={!isLocked ? onTap : undefined}
    >
      {/* Icon circle */}
      <div
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base border-2",
          statusKey === "STARTED" && "border-blue-300 bg-blue-100",
          statusKey === "FINISHED" && "border-green-300 bg-green-100",
          statusKey === "REVIEWED" && "border-amber-300 bg-amber-100",
          statusKey === "OUTSTANDING" && "border-slate-200 bg-slate-100",
          statusKey === "LOCKED" && "border-slate-100 bg-slate-50",
        )}
      >
        {statusKey === "FINISHED"
          ? "✅"
          : statusKey === "REVIEWED"
            ? "⭐"
            : focusEmoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {assignment.lesson.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {assignment.lesson.durationMinutes}m
          </span>
          <span>·</span>
          <span>{focusPath}</span>
        </div>
      </div>

      {/* Status badge */}
      <span
        className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-semibold flex-shrink-0",
          style.badge,
        )}
      >
        {style.label}
      </span>
    </div>
  );
}

// ─── Block Card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  isFirst,
  onAssignmentUpdated,
}: {
  block: TrainingBlock;
  isFirst: boolean;
  onAssignmentUpdated: (updated: LessonAssignment) => void;
}) {
  const total = block.assignments.length;
  const done = block.assignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED",
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const blockDone = done === total && total > 0;
  const blockStarted = block.assignments.some(
    (a) => a.status !== "OUTSTANDING",
  );

  const [expanded, setExpanded] = useState(
    isFirst || blockStarted || !blockDone,
  );
  const [selectedAssignment, setSelectedAssignment] =
    useState<LessonAssignment | null>(null);
  const [celebration, setCelebration] = useState<{
    lessonName: string;
    nextLesson?: string;
  } | null>(null);

  function handleStatusChange(updated: LessonAssignment) {
    onAssignmentUpdated(updated);
    if (selectedAssignment) setSelectedAssignment(updated);
    if (updated.status === "FINISHED") {
      const idx = block.assignments.findIndex((a) => a.id === updated.id);
      const nextAssignment = block.assignments[idx + 1];
      setCelebration({
        lessonName: updated.lesson.name,
        nextLesson: nextAssignment?.lesson.name,
      });
    }
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border overflow-hidden",
          blockDone ? "border-green-200" : "border-gray-200",
        )}
      >
        {/* Block header */}
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left bg-white hover:bg-slate-50/50 transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{block.name}</p>
            {blockStarted && !blockDone && (
              <p className="text-xs text-blue-600 font-medium mt-0.5">
                In Progress
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {/* Circular progress */}
            <div className="relative h-8 w-8">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke={blockDone ? "#22c55e" : "#3b82f6"}
                  strokeWidth="3"
                  strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-600">
                {pct}%
              </span>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </button>

        {/* Lessons */}
        {expanded && (
          <div className="border-t border-gray-100 bg-slate-50/30 px-4 py-3 space-y-2">
            {block.assignments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">
                No lessons in this block yet.
              </p>
            ) : (
              block.assignments.map((assignment, idx) => {
                const prevDone =
                  idx === 0 ||
                  block.assignments[idx - 1].status === "FINISHED" ||
                  block.assignments[idx - 1].status === "REVIEWED";
                const isLocked =
                  !prevDone && assignment.status === "OUTSTANDING";
                return (
                  <LessonCard
                    key={assignment.id}
                    assignment={assignment}
                    isLocked={isLocked}
                    onTap={() => setSelectedAssignment(assignment)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedAssignment && (
        <LessonDetailModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {celebration && (
        <CompletionCelebration
          lessonName={celebration.lessonName}
          nextLesson={celebration.nextLesson}
          onDismiss={() => setCelebration(null)}
        />
      )}
    </>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onAssignmentUpdated,
}: {
  plan: PlayerDevelopmentPlan;
  onAssignmentUpdated: (blockId: string, updated: LessonAssignment) => void;
}) {
  const coachName = plan.coach
    ? `Coach ${plan.coach.firstName ?? plan.coach.email}`
    : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Plan header */}
      <div className="flex items-start justify-between px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">
            {plan.name}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {plan.ownerType === "TEAM" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                👥 Team{plan.team?.shortName ? ` · ${plan.team.shortName}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                👤 Personal
              </span>
            )}
            {coachName && (
              <span className="text-sm text-slate-500">{coachName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="px-4 pb-4 space-y-3">
        {plan.blocks.map((block, blockIdx) => (
          <BlockCard
            key={block.id}
            block={block}
            isFirst={blockIdx === 0}
            onAssignmentUpdated={(updated) =>
              onAssignmentUpdated(block.id, updated)
            }
          />
        ))}
        {plan.blocks.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No training blocks yet.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Journey Header ───────────────────────────────────────────────────────────

function JourneyHeader({
  playerName,
  plans,
}: {
  playerName: string;
  plans: PlayerDevelopmentPlan[];
}) {
  const allAssignments = plans.flatMap((p) =>
    p.blocks.flatMap((b) => b.assignments),
  );
  const total = allAssignments.length;
  const done = allAssignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED",
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const xp = computeXp(plans);
  const { level, progress } = xpLevel(xp);

  return (
    <header className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Player Mission &amp; Journey
          </p>
          <h1 className="mt-0.5 text-xl font-extrabold tracking-tight">
            {playerName ? `${playerName}'s Path` : "My Development Path"}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-sm font-bold">Lv {level}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Zap className="h-3 w-3 text-amber-400" />
            {xp} XP
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {done} of {total} lessons complete
          </span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/15">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-300 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-500">Level {level} XP</span>
          <span className="text-slate-500">
            {progress}% to Level {level + 1}
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-amber-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </header>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlayerJourney() {
  const [plans, setPlans] = useState<PlayerDevelopmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.firstName || me?.lastName) {
          setPlayerName(`${me.firstName ?? ""} ${me.lastName ?? ""}`.trim());
        }
      })
      .catch(() => {});
  }, []);

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

  function handleAssignmentUpdated(
    planId: string,
    blockId: string,
    updated: LessonAssignment,
  ) {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id !== planId
          ? plan
          : {
              ...plan,
              blocks: plan.blocks.map((block) =>
                block.id !== blockId
                  ? block
                  : {
                      ...block,
                      assignments: block.assignments.map((a) =>
                        a.id === updated.id ? updated : a,
                      ),
                    },
              ),
            },
      ),
    );
  }

  if (loading) return <JourneySkeleton />;

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="mb-4 text-6xl">⛳</div>
        <h2 className="text-xl font-bold text-slate-800">
          No Training Plans Yet
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Your coach hasn&apos;t set up a development plan for you yet. Check
          back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10 max-w-lg mx-auto">
      <JourneyHeader playerName={playerName} plans={plans} />

      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          onAssignmentUpdated={(blockId, updated) =>
            handleAssignmentUpdated(plan.id, blockId, updated)
          }
        />
      ))}
    </div>
  );
}

// ─── Lesson Detail Modal ──────────────────────────────────────────────────────

function LessonDetailModal({
  assignment,
  onClose,
  onStatusChange,
}: {
  assignment: LessonAssignment;
  onClose: () => void;
  onStatusChange: (updated: LessonAssignment) => void;
}) {
  const [status, setStatus] = useState(assignment.status);
  const [notes, setNotes] = useState(assignment.playerNotes ?? "");
  const [selfAssessment, setSelfAssessment] = useState<string>(
    assignment.selfAssessment != null ? String(assignment.selfAssessment) : "",
  );
  const [saving, setSaving] = useState(false);

  const focusPath = getFocusAreaPath(
    assignment.lesson.focusArea,
    assignment.lesson.subCapability,
    assignment.lesson.subSubCapability,
  );
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";
  const exercises = missionChecklist(assignment.lesson.plannedExercises);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateAssignment(assignment.id, {
        status,
        playerNotes: notes || undefined,
        selfAssessment: selfAssessment ? parseInt(selfAssessment, 10) : null,
      });
      if (updated?.id) {
        onStatusChange(updated);
        toast.success("Progress saved");
      } else {
        toast.error("Failed to save progress");
      }
    } catch {
      toast.error("Failed to save progress");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 rounded-t-3xl sm:rounded-t-2xl">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {focusEmoji} {focusPath}
            </p>
            <h2 className="text-lg font-bold text-slate-800">
              {assignment.lesson.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 text-slate-400 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-200">
              Mission Card
            </p>
            <h3 className="mt-2 text-xl font-bold leading-tight">
              {assignment.lesson.trainingObjective || assignment.lesson.name}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-3 py-1">
                <Clock className="mr-1 inline h-3 w-3" />
                {assignment.lesson.durationMinutes} minutes
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1">
                {status}
              </span>
              {assignment.dueDate && (
                <span className="rounded-full bg-white/15 px-3 py-1">
                  Due {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {exercises.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Exercises checklist
              </h3>
              <div className="space-y-2">
                {exercises.map((exercise, index) => (
                  <div
                    key={`${exercise}-${index}`}
                    className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <span className="mt-0.5 text-green-600">☐</span>
                    <span className="text-sm text-slate-700">{exercise}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assignment.lesson.successCriteria && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Success criteria
              </h3>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {assignment.lesson.successCriteria}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Completion flow
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {ASSIGNMENT_STATUSES.filter((s) => s.value !== "REVIEWED").map(
                (s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={cn(
                      "rounded-2xl border-2 py-3 text-xs font-semibold transition-all",
                      status === s.value
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-200 text-slate-500 hover:border-slate-300",
                    )}
                  >
                    {s.value === "OUTSTANDING"
                      ? "Open"
                      : s.value === "STARTED"
                        ? "Start"
                        : "Complete"}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Self Assessment */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Self Assessment (1–10)
            </h3>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    setSelfAssessment(
                      selfAssessment === String(n) ? "" : String(n),
                    )
                  }
                  className={cn(
                    "h-10 w-10 rounded-full border-2 text-sm font-semibold transition-all",
                    selfAssessment === String(n)
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-200 text-slate-600 hover:border-blue-300",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Star rating display */}
          {selfAssessment && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i < parseInt(selfAssessment, 10)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200",
                  )}
                />
              ))}
              <span className="ml-2 text-sm font-semibold text-slate-600">
                {selfAssessment}/10
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Practice Notes (optional)
            </h3>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="How did it go? What did you learn?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 py-3 text-base font-bold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : status === "FINISHED"
                ? "✅ Complete Mission"
                : "Save Mission"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function JourneySkeleton() {
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="h-36 animate-pulse rounded-2xl bg-slate-800/10" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="h-14 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
