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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Clock, ChevronDown, ChevronUp, CheckCircle2, Circle, PlayCircle, Star, Lock } from "lucide-react";

const FOCUS_AREA_EMOJI: Record<string, string> = {
  SETUP: "🏌️",
  PUTTING: "⛳",
  SHORT_GAME: "🎯",
  LONG_GAME: "💪",
  TACTICAL: "🧠",
  FITNESS: "🏃",
  MENTAL: "🧘",
};

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  OUTSTANDING: {
    icon: <Circle className="h-5 w-5" />,
    color: "text-slate-400",
    bg: "bg-slate-50 border-slate-200",
    label: "Not Started",
  },
  STARTED: {
    icon: <PlayCircle className="h-5 w-5" />,
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-200",
    label: "In Progress",
  },
  FINISHED: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "text-green-500",
    bg: "bg-green-50 border-green-200",
    label: "Completed",
  },
  REVIEWED: {
    icon: <Star className="h-5 w-5" />,
    color: "text-amber-500",
    bg: "bg-amber-50 border-amber-200",
    label: "Reviewed",
  },
};

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

  useEffect(() => { loadPlans(); }, [loadPlans]);

  function handleAssignmentUpdated(planId: string, blockId: string, updated: LessonAssignment) {
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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 text-6xl">⛳</div>
        <h2 className="text-xl font-semibold text-slate-800">No Training Plans Yet</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Your coach hasn't set up a development plan for you yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      {playerName && (
        <header className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-5 text-white">
          <p className="text-sm font-medium text-blue-200 uppercase tracking-wider">
            Training Journey
          </p>
          <h1 className="mt-1 text-2xl font-bold">{playerName}&apos;s Development Plan</h1>
          <OverallProgress plans={plans} />
        </header>
      )}

      {/* Plans */}
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

// ─── Overall Progress ─────────────────────────────────────────────────────────

function OverallProgress({ plans }: { plans: PlayerDevelopmentPlan[] }) {
  const total = plans.flatMap((p) => p.blocks.flatMap((b) => b.assignments)).length;
  const done = plans
    .flatMap((p) => p.blocks.flatMap((b) => b.assignments))
    .filter((a) => a.status === "FINISHED" || a.status === "REVIEWED").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-blue-200">{done} of {total} lessons complete</span>
        <span className="font-bold">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-blue-500/40">
        <div
          className="h-2 rounded-full bg-white transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <h2 className="text-lg font-bold text-slate-800">{plan.name}</h2>
        {plan.coach && (
          <span className="text-xs text-slate-400">
            · Coach {plan.coach.firstName ?? plan.coach.email}
          </span>
        )}
      </div>
      {plan.description && (
        <p className="px-1 text-sm text-slate-600">{plan.description}</p>
      )}

      {/* Vertical timeline */}
      <div className="relative space-y-3">
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

  const total = block.assignments.length;
  const done = block.assignments.filter(
    (a) => a.status === "FINISHED" || a.status === "REVIEWED"
  ).length;

  return (
    <Card className={cn(
      "border overflow-hidden transition-all",
      blockDone ? "border-green-200 bg-green-50/30" : "border-gray-200"
    )}>
      {/* Block header */}
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl",
            blockDone ? "bg-green-100" : "bg-blue-100"
          )}>
            {blockDone ? "✅" : "🎯"}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{block.name}</p>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{done} of {total} lessons</span>
              {block.goal && <><span>·</span><span>{block.goal}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="h-1.5 w-20 rounded-full bg-slate-200">
                <div
                  className={cn("h-1.5 rounded-full transition-all", blockDone ? "bg-green-500" : "bg-blue-500")}
                  style={{ width: `${Math.round((done / total) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{Math.round((done / total) * 100)}%</span>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {block.assignments.map((assignment, idx) => {
            const prevDone =
              idx === 0 ||
              (block.assignments[idx - 1].status === "FINISHED" ||
                block.assignments[idx - 1].status === "REVIEWED");
            return (
              <TrainingCard
                key={assignment.id}
                assignment={assignment}
                unlocked={prevDone}
                onTap={() => setSelectedAssignment(assignment)}
                onStatusChange={onAssignmentUpdated}
              />
            );
          })}
        </div>
      )}

      {/* Lesson Detail Modal */}
      {selectedAssignment && (
        <LessonDetailModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onStatusChange={(updated) => {
            onAssignmentUpdated(updated);
            setSelectedAssignment(updated);
          }}
        />
      )}
    </Card>
  );
}

// ─── Training Card ────────────────────────────────────────────────────────────

function TrainingCard({
  assignment,
  unlocked,
  onTap,
  onStatusChange,
}: {
  assignment: LessonAssignment;
  unlocked: boolean;
  onTap: () => void;
  onStatusChange: (updated: LessonAssignment) => void;
}) {
  const sc = STATUS_CONFIG[assignment.status] ?? STATUS_CONFIG.OUTSTANDING;
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";
  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === assignment.lesson.focusArea)?.label ??
    assignment.lesson.focusArea;

  const isLocked = !unlocked && assignment.status === "OUTSTANDING";
  const [updating, setUpdating] = useState(false);

  async function advanceStatus() {
    if (isLocked || updating) return;
    const next: Record<string, string> = {
      OUTSTANDING: "STARTED",
      STARTED: "FINISHED",
    };
    const nextStatus = next[assignment.status];
    if (!nextStatus) return;
    setUpdating(true);
    try {
      const updated = await api.updateAssignment(assignment.id, { status: nextStatus });
      if (updated?.id) onStatusChange(updated);
      else toast.error("Failed to update status");
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all",
        isLocked ? "border-slate-100 bg-slate-50 opacity-60" : sc.bg,
        !isLocked && "cursor-pointer hover:shadow-md"
      )}
      onClick={!isLocked ? onTap : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn("mt-0.5 flex-shrink-0", sc.color)}>
            {isLocked ? <Lock className="h-5 w-5 text-slate-300" /> : sc.icon}
          </span>
          <div>
            <p className={cn("font-medium", isLocked ? "text-slate-400" : "text-slate-800")}>
              {isLocked ? (
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  {assignment.lesson.name}
                </span>
              ) : assignment.lesson.name}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              <span>{focusEmoji} {focusLabel}</span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {assignment.lesson.durationMinutes}m
              </span>
              {assignment.dueDate && !isLocked && (
                <span>Due {new Date(assignment.dueDate).toLocaleDateString()}</span>
              )}
            </div>
            {isLocked && (
              <p className="mt-1 text-xs text-slate-400">Complete previous lesson first</p>
            )}
          </div>
        </div>

        {!isLocked && assignment.status !== "FINISHED" && assignment.status !== "REVIEWED" && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); advanceStatus(); }}
            disabled={updating}
            className={cn(
              "flex-shrink-0 text-xs",
              assignment.status === "OUTSTANDING"
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-green-600 text-white hover:bg-green-500"
            )}
          >
            {updating ? "…" : assignment.status === "OUTSTANDING" ? "▶ Start" : "✓ Finish"}
          </Button>
        )}
        {(assignment.status === "FINISHED" || assignment.status === "REVIEWED") && (
          <span className="text-xs font-medium text-green-600 flex-shrink-0">
            {assignment.status === "REVIEWED" ? "⭐ Reviewed" : "✅ Done"}
          </span>
        )}
      </div>
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
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{focusEmoji} {focusLabel}</p>
            <h2 className="text-lg font-bold text-slate-800">{assignment.lesson.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 text-slate-400">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Overview */}
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
              <h3 className="mb-1 text-sm font-semibold text-slate-700">🎯 Training Objective</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{assignment.lesson.trainingObjective}</p>
            </div>
          )}

          {/* Exercises */}
          {assignment.lesson.plannedExercises && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">📋 Exercises</h3>
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{assignment.lesson.plannedExercises}</pre>
            </div>
          )}

          {/* Success Criteria */}
          {assignment.lesson.successCriteria && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700">✅ Success Criteria</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{assignment.lesson.successCriteria}</p>
            </div>
          )}

          {/* Status update */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Update Progress</h3>
            <div className="grid grid-cols-3 gap-2">
              {ASSIGNMENT_STATUSES.filter((s) => s.value !== "REVIEWED").map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value as any)}
                  className={cn(
                    "rounded-xl border-2 py-2.5 text-xs font-medium transition-all",
                    status === s.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Self assessment */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Self Assessment (1–10)</h3>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setSelfAssessment(selfAssessment === String(n) ? "" : String(n))}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 text-sm font-medium transition-all",
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

          {/* Practice notes */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Practice Notes (optional)</h3>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="How did it go? What did you learn?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-500"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Progress"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function JourneySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-blue-100" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
