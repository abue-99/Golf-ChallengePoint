"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FOCUS_AREAS, type PlayerDevelopmentPlan, type TrainingLesson, type LessonAssignment } from "@/lib/lesson-types";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Target,
  Clock,
  Calendar,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  playerId: string;
}

const FOCUS_AREA_EMOJI: Record<string, string> = {
  SETUP: "🏌️",
  PUTTING: "⛳",
  SHORT_GAME: "🎯",
  LONG_GAME: "💪",
  TACTICAL: "🧠",
  FITNESS: "🏃",
  MENTAL: "🧘",
};

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  OUTSTANDING: "bg-slate-100 text-slate-600",
  STARTED: "bg-blue-100 text-blue-700",
  FINISHED: "bg-green-100 text-green-700",
  REVIEWED: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  OUTSTANDING: "Outstanding",
  STARTED: "In Progress",
  FINISHED: "Finished",
  REVIEWED: "Reviewed",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function DevelopmentPlanManager({ playerId }: Props) {
  const [plans, setPlans] = useState<PlayerDevelopmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listPlansForPlayer(playerId);
      setPlans(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PlanSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Development Plans</h2>
        <Button
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-500"
          onClick={() => setShowNewPlan(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Plan
        </Button>
      </div>

      {showNewPlan && (
        <NewPlanForm
          playerId={playerId}
          onCreated={(plan) => {
            setPlans((prev) => [plan, ...prev]);
            setShowNewPlan(false);
          }}
          onCancel={() => setShowNewPlan(false)}
        />
      )}

      {plans.length === 0 && !showNewPlan ? (
        <Card className="border border-dashed">
          <CardContent className="p-8 text-center text-slate-500">
            <Target className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">No development plans yet</p>
            <p className="text-sm">Create a structured training journey for this player.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              playerId={playerId}
              onDeleted={() => setPlans((prev) => prev.filter((p) => p.id !== plan.id))}
              onUpdated={(updated) => setPlans((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Plan Form ────────────────────────────────────────────────────────────

function NewPlanForm({
  playerId,
  onCreated,
  onCancel,
}: {
  playerId: string;
  onCreated: (plan: PlayerDevelopmentPlan) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const plan = await api.createPlan({
        playerId,
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (plan?.id) {
        onCreated(plan);
        toast.success("Development plan created");
      } else {
        toast.error("Failed to create plan");
      }
    } catch {
      toast.error("Failed to create plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-blue-200 bg-blue-50/50">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="font-medium text-slate-800">New Development Plan</h3>
          <input
            autoFocus
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Plan name (e.g. Putting Improvement Plan)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">End Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-500">
              {saving ? "Creating…" : "Create Plan"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Edit Plan Form ───────────────────────────────────────────────────────────

function EditPlanForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan: PlayerDevelopmentPlan;
  onSaved: (updated: PlayerDevelopmentPlan) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [startDate, setStartDate] = useState(plan.startDate ? plan.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(plan.endDate ? plan.endDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updatePlan(plan.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (updated?.id) {
        onSaved(updated);
        toast.success("Plan updated");
      } else {
        toast.error("Failed to update plan");
      }
    } catch {
      toast.error("Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-amber-200 bg-amber-50/40">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <h3 className="font-medium text-slate-800">Edit Plan</h3>
          <input
            autoFocus
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="Plan name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">End Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="bg-amber-500 text-white hover:bg-amber-400">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  playerId,
  onDeleted,
  onUpdated,
}: {
  plan: PlayerDevelopmentPlan;
  playerId: string;
  onDeleted: () => void;
  onUpdated: (plan: PlayerDevelopmentPlan) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [editing, setEditing] = useState(false);
  const [blocks, setBlocks] = useState(plan.blocks);
  const [deleting, setDeleting] = useState(false);

  const totalAssignments = blocks.reduce((s, b) => s + b.assignments.length, 0);
  const completedAssignments = blocks.reduce(
    (s, b) => s + b.assignments.filter((a) => a.status === "FINISHED" || a.status === "REVIEWED").length,
    0
  );
  const progress = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  async function handleDelete() {
    if (!confirm(`Delete plan "${plan.name}"? This will also delete all training blocks and assignments.`)) return;
    setDeleting(true);
    try {
      await api.deletePlan(plan.id);
      toast.success("Plan deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete plan");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <EditPlanForm
        plan={plan}
        onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Plan header */}
      <div
        className="flex cursor-pointer items-start justify-between px-5 py-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-lg text-slate-900 leading-tight truncate">{plan.name}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-500">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
            <span className="text-xs text-slate-500">{totalAssignments} lesson{totalAssignments !== 1 ? "s" : ""}</span>
            {totalAssignments > 0 && (
              <span className="text-xs font-semibold text-blue-600">{progress}% complete</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 h-8 w-8 p-0"
            title="Edit plan"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
            title="Delete plan"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <span className="text-slate-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {totalAssignments > 0 && (
        <div className="px-5 pb-3">
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-3">
          {plan.description && (
            <p className="text-sm text-slate-600">{plan.description}</p>
          )}

          {(plan.startDate || plan.endDate) && (
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {plan.startDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(plan.startDate).toLocaleDateString()}
                </span>
              )}
              {plan.endDate && (
                <span>→ {new Date(plan.endDate).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* Training blocks */}
          <div className="space-y-3">
            {blocks.map((block) => (
              <TrainingBlockCard
                key={block.id}
                block={block}
                playerId={playerId}
                onDeleted={() => setBlocks((prev) => prev.filter((b) => b.id !== block.id))}
                onUpdated={(updated) => setBlocks((prev) => prev.map((b) => b.id === updated.id ? { ...b, ...updated } : b))}
              />
            ))}

            {showNewBlock ? (
              <NewBlockForm
                planId={plan.id}
                onCreated={(block) => {
                  setBlocks((prev) => [...prev, block]);
                  setShowNewBlock(false);
                }}
                onCancel={() => setShowNewBlock(false)}
              />
            ) : (
              <button
                onClick={() => setShowNewBlock(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Training Block
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Block Form ───────────────────────────────────────────────────────────

function NewBlockForm({
  planId,
  onCreated,
  onCancel,
}: {
  planId: string;
  onCreated: (block: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const block = await api.createBlock(planId, {
        name: name.trim(),
        goal: goal.trim() || undefined,
      });
      if (block?.id) {
        onCreated(block);
        toast.success("Training block added");
      } else {
        toast.error("Failed to add block");
      }
    } catch {
      toast.error("Failed to add block");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-blue-200 bg-blue-50/40">
      <CardContent className="p-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            autoFocus
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Block name (e.g. Putting Consistency)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Goal (optional)"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-500">
              {saving ? "Adding…" : "Add Block"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Edit Block Form ──────────────────────────────────────────────────────────

function EditBlockForm({
  block,
  onSaved,
  onCancel,
}: {
  block: any;
  onSaved: (updated: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(block.name);
  const [goal, setGoal] = useState(block.goal ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateBlock(block.id, {
        name: name.trim(),
        goal: goal.trim() || undefined,
      });
      if (updated?.id) {
        onSaved(updated);
        toast.success("Block updated");
      } else {
        toast.error("Failed to update block");
      }
    } catch {
      toast.error("Failed to update block");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          autoFocus
          required
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
          placeholder="Block name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
          placeholder="Goal (optional)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={saving} className="bg-amber-500 text-white hover:bg-amber-400">
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ─── Training Block Card ──────────────────────────────────────────────────────

function TrainingBlockCard({
  block,
  playerId,
  onDeleted,
  onUpdated,
}: {
  block: any;
  playerId: string;
  onDeleted: () => void;
  onUpdated: (block: any) => void;
}) {
  const [assignments, setAssignments] = useState<LessonAssignment[]>(block.assignments || []);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const total = assignments.length;
  const done = assignments.filter((a) => a.status === "FINISHED" || a.status === "REVIEWED").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function loadLessons() {
    if (lessons.length > 0) return;
    setLoadingLessons(true);
    try {
      const data = await api.listLessons();
      setLessons(Array.isArray(data) ? data : []);
    } finally {
      setLoadingLessons(false);
    }
  }

  async function handleDeleteBlock() {
    if (!confirm(`Delete block "${block.name}"?`)) return;
    setDeleting(true);
    try {
      await api.deleteBlock(block.id);
      toast.success("Block deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete block");
      setDeleting(false);
    }
  }

  async function handleAddLesson(lessonId: string, dueDate?: string, priority?: string) {
    try {
      const assignment = await api.addAssignment(block.id, {
        lessonId,
        playerId,
        dueDate: dueDate || undefined,
        priority: priority || "MEDIUM",
        sortOrder: assignments.length,
      });
      if (assignment?.id) {
        setAssignments((prev) => [...prev, assignment]);
        toast.success("Lesson added to block");
        setShowAddLesson(false);
      } else {
        toast.error("Failed to add lesson");
      }
    } catch {
      toast.error("Failed to add lesson");
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      await api.removeAssignment(assignmentId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      toast.success("Lesson removed");
    } catch {
      toast.error("Failed to remove lesson");
    }
  }

  if (editing) {
    return (
      <EditBlockForm
        block={block}
        onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Block header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{block.name}</p>
            {block.goal && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">Goal: {block.goal}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">{done}/{total} lessons</p>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {/* Circular progress */}
          <div className="relative h-8 w-8 mr-1">
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={done === total && total > 0 ? "#22c55e" : "#3b82f6"}
                strokeWidth="3"
                strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-600">
              {pct}%
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 h-7 w-7 p-0"
            title="Edit block"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={handleDeleteBlock}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0"
            title="Delete block"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-slate-400 hover:text-slate-600"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Lessons */}
      {expanded && (
        <div className="border-t border-gray-100 bg-slate-50/30 px-4 py-3 space-y-2">
          {assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              onRemove={() => handleRemoveAssignment(a.id)}
            />
          ))}

          {showAddLesson ? (
            <AddLessonForm
              lessons={lessons}
              loading={loadingLessons}
              onAdd={handleAddLesson}
              onCancel={() => setShowAddLesson(false)}
            />
          ) : (
            <button
              onClick={() => { setShowAddLesson(true); loadLessons(); }}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Lesson
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Assignment Row ───────────────────────────────────────────────────────────

function AssignmentRow({
  assignment,
  onRemove,
}: {
  assignment: LessonAssignment;
  onRemove: () => void;
}) {
  const focusEmoji = FOCUS_AREA_EMOJI[assignment.lesson.focusArea] ?? "📋";
  const focusLabel = FOCUS_AREAS.find((f) => f.value === assignment.lesson.focusArea)?.label ?? assignment.lesson.focusArea;
  const badgeClass = STATUS_BADGE[assignment.status] ?? "bg-slate-100 text-slate-600";
  const statusLabel = STATUS_LABEL[assignment.status] ?? assignment.status;

  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-gray-100 bg-white px-3 py-2.5">
      {/* Icon */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-base">
        {focusEmoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{assignment.lesson.name}</p>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {assignment.lesson.durationMinutes}m
          </span>
          <span>·</span>
          <span>{focusLabel}</span>
          {assignment.dueDate && (
            <>
              <span>·</span>
              <span>Due {new Date(assignment.dueDate).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badgeClass)}>
          {statusLabel}
        </span>
        <button
          onClick={onRemove}
          className="text-slate-300 hover:text-red-500 transition-colors"
          title="Remove lesson"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Add Lesson Form ──────────────────────────────────────────────────────────

function AddLessonForm({
  lessons,
  loading,
  onAdd,
  onCancel,
}: {
  lessons: TrainingLesson[];
  loading: boolean;
  onAdd: (lessonId: string, dueDate?: string, priority?: string) => void;
  onCancel: () => void;
}) {
  const [lessonId, setLessonId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
      <select
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        value={lessonId}
        onChange={(e) => setLessonId(e.target.value)}
      >
        <option value="">{loading ? "Loading lessons…" : "Select a lesson…"}</option>
        {lessons.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({FOCUS_AREAS.find((f) => f.value === l.focusArea)?.label ?? l.focusArea}, {l.durationMinutes}m)
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="date"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Due date (optional)"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!lessonId}
          onClick={() => onAdd(lessonId, dueDate, priority)}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-24 animate-pulse rounded bg-slate-200" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
