"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  ASSIGNMENT_STATUSES,
  type PlayerDevelopmentPlan,
  type TrainingBlock,
  type LessonAssignment,
} from "@/lib/lesson-types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, ChevronDown, ChevronUp, Star, Lock, Zap, Trophy } from "lucide-react";

const FOCUS_AREA_EMOJI: Record<string, string> = {
  SETUP: "🏌️",
  PUTTING: "⛳",
  SHORT_GAME: "🎯",
  LONG_GAME: "💪",
  TACTICAL: "🧠",
  FITNESS: "🏃",
  MENTAL: "🧘",
};

// ─── Status Configuration ─────────────────────────────────────────────────────

type StatusKey = "OUTSTANDING" | "STARTED" | "FINISHED" | "REVIEWED" | "LOCKED";

const NODE_CONFIG: Record<StatusKey, {
  emoji: string;
  label: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
  dotColor: string;
}> = {
  OUTSTANDING: {
    emoji: "⚪",
    label: "Open",
    ringColor: "border-slate-300",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
    dotColor: "bg-slate-400",
  },
  STARTED: {
    emoji: "🟡",
    label: "In Progress",
    ringColor: "border-blue-400",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    dotColor: "bg-blue-500",
  },
  FINISHED: {
    emoji: "✅",
    label: "Completed",
    ringColor: "border-green-400",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    dotColor: "bg-green-500",
  },
  REVIEWED: {
    emoji: "⭐",
    label: "Reviewed by Coach",
    ringColor: "border-amber-400",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    dotColor: "bg-amber-400",
  },
  LOCKED: {
    emoji: "🔒",
    label: "Locked",
    ringColor: "border-slate-200",
    bgColor: "bg-slate-50",
    textColor: "text-slate-400",
    dotColor: "bg-slate-300",
  },
};

function resolveStatus(assignment: LessonAssignment, isLocked: boolean): StatusKey {
  if (isLocked) return "LOCKED";
  return assignment.status as StatusKey;
}

// ─── XP helpers ──────────────────────────────────────────────────────────────

function computeXp(plans: PlayerDevelopmentPlan[]): number {
  let xp = 0;
  for (const plan of plans) {
    for (const block of plan.blocks) {
      const done = block.assignments.filter(
        (a) => a.status === "FINISHED" || a.status === "REVIEWED"
      ).length;
      xp += done * 50;
      if (done === block.assignments.length && block.assignments.length > 0) xp += 500;
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
        <h2 className="text-2xl font-extrabold tracking-tight">LESSON COMPLETED</h2>
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

// ─── Journey Node ─────────────────────────────────────────────────────────────

function JourneyNode({
  assignment,
  isLocked,
  isLast,
  onTap,
}: {
  assignment: LessonAssignment;
  isLocked: boolean;
  isLast: boolean;
  onTap: () => void;
}) {
  const statusKey = resolveStatus(assignment, isLocked);
  const cfg = NODE_CONFIG[statusKey];
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";
  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === assignment.lesson.focusArea)?.label ??
    assignment.lesson.focusArea;

  return (
    <div className="flex gap-4">
      {/* Left track: dot + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            "h-9 w-9 rounded-full border-2 flex items-center justify-center text-base shadow-sm flex-shrink-0 transition-all duration-300",
            cfg.ringColor,
            cfg.bgColor,
            statusKey === "STARTED" && "ring-2 ring-blue-300 ring-offset-1",
            statusKey === "FINISHED" && "ring-2 ring-green-300 ring-offset-1",
            statusKey === "REVIEWED" && "ring-2 ring-amber-300 ring-offset-1",
          )}
        >
          {statusKey === "LOCKED" ? (
            <Lock className="h-4 w-4 text-slate-300" />
          ) : statusKey === "FINISHED" ? (
            "✅"
          ) : statusKey === "REVIEWED" ? (
            "⭐"
          ) : statusKey === "STARTED" ? (
            "🟡"
          ) : (
            "⚪"
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-[24px] mt-1",
              statusKey === "FINISHED" || statusKey === "REVIEWED"
                ? "bg-green-300"
                : statusKey === "STARTED"
                ? "bg-blue-200"
                : "bg-slate-200"
            )}
          />
        )}
      </div>

      {/* Right content */}
      <div className={cn("pb-4 flex-1", isLast && "pb-0")}>
        <div
          className={cn(
            "rounded-2xl border-2 p-4 transition-all duration-200",
            cfg.ringColor,
            cfg.bgColor,
            !isLocked && "cursor-pointer active:scale-[0.98] hover:shadow-md",
            isLocked && "opacity-60"
          )}
          onClick={!isLocked ? onTap : undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="text-lg leading-none mt-0.5">{focusEmoji}</span>
              <div>
                <p className={cn("font-semibold leading-tight", cfg.textColor)}>
                  {assignment.lesson.name}
                </p>
                <div className="mt-1 flex items-center gap-2.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {assignment.lesson.durationMinutes}m
                  </span>
                  <span>{focusLabel}</span>
                </div>
              </div>
            </div>
            <span className={cn("text-xs font-semibold flex-shrink-0 mt-0.5", cfg.textColor)}>
              {cfg.label}
            </span>
          </div>

          {statusKey === "LOCKED" && (
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Complete previous lesson first
            </p>
          )}

          {assignment.lesson.trainingObjective && !isLocked && (
            <p className="mt-2 text-xs text-slate-500 line-clamp-1">
              {assignment.lesson.trainingObjective}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Block Journey Card ───────────────────────────────────────────────────────

function BlockJourneyCard({
  block,
  isFirst,
  blockDone,
  blockStarted,
  onAssignmentUpdated,
}: {
  block: TrainingBlock;
  isFirst: boolean;
  blockDone: boolean;
  blockStarted: boolean;
  onAssignmentUpdated: (updated: LessonAssignment) => void;
}) {
  const [expanded, setExpanded] = useState(isFirst || blockStarted || !blockDone);
  const [selectedAssignment, setSelectedAssignment] = useState<LessonAssignment | null>(null);
  const [celebration, setCelebration] = useState<{
    lessonName: string;
    nextLesson?: string;
  } | null>(null);

  const total = block.assignments.length;
  const done = block.assignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED"
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

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
          "rounded-2xl border-2 overflow-hidden transition-all duration-300",
          blockDone ? "border-green-300 bg-green-50/20" : "border-slate-200 bg-white"
        )}
      >
        {/* Block header */}
        <button
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-xl shadow-sm",
                blockDone ? "bg-green-100" : blockStarted ? "bg-blue-100" : "bg-slate-100"
              )}
            >
              {blockDone ? "🏆" : blockStarted ? "🎯" : "📋"}
            </div>
            <div>
              <p className="font-bold text-slate-800">{block.name}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{done} of {total} lessons</span>
                {block.goal && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[120px]">{block.goal}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mini circular progress */}
            <div className="relative h-9 w-9 flex-shrink-0">
              <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={blockDone ? "#22c55e" : "#3b82f6"}
                  strokeWidth="3"
                  strokeDasharray={`${(pct / 100) * 94.25} 94.25`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-600">
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

        {/* Vertical path */}
        {expanded && (
          <div className="px-5 pb-5 pt-1">
            {/* Progress bar */}
            <div className="mb-4 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all duration-700",
                  blockDone ? "bg-green-500" : "bg-blue-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Node list */}
            <div>
              {block.assignments.map((assignment, idx) => {
                const prevDone =
                  idx === 0 ||
                  block.assignments[idx - 1].status === "FINISHED" ||
                  block.assignments[idx - 1].status === "REVIEWED";
                const isLocked = !prevDone && assignment.status === "OUTSTANDING";
                return (
                  <JourneyNode
                    key={assignment.id}
                    assignment={assignment}
                    isLocked={isLocked}
                    isLast={idx === block.assignments.length - 1}
                    onTap={() => setSelectedAssignment(assignment)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lesson Detail Modal */}
      {selectedAssignment && (
        <LessonDetailModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Completion Celebration */}
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

// ─── Plan Journey View ────────────────────────────────────────────────────────

function PlanJourneyView({
  plan,
  onAssignmentUpdated,
}: {
  plan: PlayerDevelopmentPlan;
  onAssignmentUpdated: (blockId: string, updated: LessonAssignment) => void;
}) {
  const allAssignments = plan.blocks.flatMap((b) => b.assignments);
  const total = allAssignments.length;
  const done = allAssignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED"
  ).length;

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800">{plan.name}</h2>
          {plan.coach && (
            <p className="text-xs text-slate-400 mt-0.5">
              Coach {plan.coach.firstName ?? plan.coach.email}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-600">
            {done}<span className="text-slate-400 font-normal">/{total}</span>
          </p>
          <p className="text-xs text-slate-400">lessons</p>
        </div>
      </div>

      {plan.description && (
        <p className="px-1 text-sm text-slate-600">{plan.description}</p>
      )}

      {/* Training blocks */}
      <div className="space-y-3">
        {plan.blocks.map((block, blockIdx) => {
          const blockDone = block.assignments.every(
            (a) => a.status === "FINISHED" || a.status === "REVIEWED"
          );
          const blockStarted = block.assignments.some(
            (a) => a.status !== "OUTSTANDING"
          );
          return (
            <BlockJourneyCard
              key={block.id}
              block={block}
              isFirst={blockIdx === 0}
              blockDone={blockDone}
              blockStarted={blockStarted}
              onAssignmentUpdated={(updated) =>
                onAssignmentUpdated(block.id, updated)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Overall Progress Banner ──────────────────────────────────────────────────

function JourneyHeader({
  playerName,
  plans,
}: {
  playerName: string;
  plans: PlayerDevelopmentPlan[];
}) {
  const allAssignments = plans.flatMap((p) =>
    p.blocks.flatMap((b) => b.assignments)
  );
  const total = allAssignments.length;
  const done = allAssignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED"
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const xp = computeXp(plans);
  const { level, progress } = xpLevel(xp);

  return (
    <header className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Player Journey
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
          <span className="text-slate-400">{done} of {total} lessons complete</span>
          <span className="font-bold text-white">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/15">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-300 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Level XP bar */}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-500">Level {level} XP</span>
          <span className="text-slate-500">{progress}% to Level {level + 1}</span>
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
    updated: LessonAssignment
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
                        a.id === updated.id ? updated : a
                      ),
                    }
              ),
            }
      )
    );
  }

  if (loading) return <JourneySkeleton />;

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="mb-4 text-6xl">⛳</div>
        <h2 className="text-xl font-bold text-slate-800">No Training Plans Yet</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Your coach hasn&apos;t set up a development plan for you yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10 max-w-lg mx-auto">
      <JourneyHeader playerName={playerName} plans={plans} />

      {plans.map((plan) => (
        <PlanJourneyView
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
    assignment.selfAssessment != null ? String(assignment.selfAssessment) : ""
  );
  const [saving, setSaving] = useState(false);

  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === assignment.lesson.focusArea)?.label ??
    assignment.lesson.focusArea;
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";

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
              {focusEmoji} {focusLabel}
            </p>
            <h2 className="text-lg font-bold text-slate-800">{assignment.lesson.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 text-slate-400 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="h-4 w-4 text-slate-400" />
              {assignment.lesson.durationMinutes} minutes
            </div>
            {assignment.dueDate && (
              <div className="text-slate-600">
                Due {new Date(assignment.dueDate).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Objective */}
          {assignment.lesson.trainingObjective && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-slate-700">🎯 Objective</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5">
                {assignment.lesson.trainingObjective}
              </p>
            </div>
          )}

          {/* Exercises */}
          {assignment.lesson.plannedExercises && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-slate-700">📋 Exercises</h3>
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5">
                {assignment.lesson.plannedExercises}
              </pre>
            </div>
          )}

          {/* Success Criteria */}
          {assignment.lesson.successCriteria && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-slate-700">✅ Success Criteria</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5">
                {assignment.lesson.successCriteria}
              </p>
            </div>
          )}

          {/* Status */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Update Progress</h3>
            <div className="grid grid-cols-3 gap-2">
              {ASSIGNMENT_STATUSES.filter((s) => s.value !== "REVIEWED").map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value as typeof status)}
                  className={cn(
                    "rounded-2xl border-2 py-3 text-xs font-semibold transition-all",
                    status === s.value
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  {s.value === "OUTSTANDING" ? "⚪ Open" : s.value === "STARTED" ? "🟡 Started" : "✅ Done"}
                </button>
              ))}
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
                    setSelfAssessment(selfAssessment === String(n) ? "" : String(n))
                  }
                  className={cn(
                    "h-10 w-10 rounded-full border-2 text-sm font-semibold transition-all",
                    selfAssessment === String(n)
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-200 text-slate-600 hover:border-blue-300"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

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
                      : "text-slate-200"
                  )}
                />
              ))}
              <span className="ml-2 text-sm font-semibold text-slate-600">
                {selfAssessment}/10
              </span>
            </div>
          )}

          <Button
            className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 py-3 text-base font-bold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : status === "FINISHED" ? "✅ Complete Lesson" : "Save Progress"}
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
        <div key={i} className="rounded-2xl border-2 border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
