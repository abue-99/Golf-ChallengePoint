"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Zap, Trash2, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import TrainingWindowDialog, { type TrainingWindowFormData } from "./TrainingWindowDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

type CalendarTask = {
  id: string;
  title: string;
  durationMinutes: number;
  scheduledDate: string;
};

type SlotData = {
  id: string;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences: { start: string; end: string }[];
  tasks: CalendarTask[];
};

type Props = {
  userId: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  green: "bg-green-100 border-green-300 text-green-800",
  blue: "bg-blue-100 border-blue-300 text-blue-800",
  amber: "bg-amber-100 border-amber-300 text-amber-800",
  violet: "bg-violet-100 border-violet-300 text-violet-800",
  rose: "bg-rose-100 border-rose-300 text-rose-800",
  cyan: "bg-cyan-100 border-cyan-300 text-cyan-800",
};

const COLOR_BAR: Record<string, string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
};

function slotToIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("fitness") || t.includes("gym")) return "🏋";
  if (t.includes("evening") || t.includes("night")) return "🌙";
  if (t.includes("range") || t.includes("driving")) return "⛳";
  if (t.includes("putt")) return "🎯";
  if (t.includes("morning")) return "☀️";
  return "☀️";
}

function formatRecurrence(rec: string): string {
  if (rec === "NONE") return "One-time";
  if (rec === "WEEKLY") return "Every week";
  if (rec === "MONTHLY") return "Every month";
  return rec;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getDurationMin(occ: { start: string; end: string }): number {
  const s = new Date(occ.start).getTime();
  const e = new Date(occ.end).getTime();
  return Math.round((e - s) / 60000);
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Capacity bar ─────────────────────────────────────────────────────────────

function CapacityBar({
  assignedMin,
  totalMin,
  colorKey,
}: {
  assignedMin: number;
  totalMin: number;
  colorKey: string;
}) {
  const pct = totalMin > 0 ? Math.min(100, Math.round((assignedMin / totalMin) * 100)) : 0;
  const bar = COLOR_BAR[colorKey] ?? "bg-green-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{assignedMin} / {totalMin} min planned</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Window Card ─────────────────────────────────────────────────────────────

function WindowCard({
  slot,
  onEdit,
  onDelete,
}: {
  slot: SlotData;
  onEdit: (slot: SlotData) => void;
  onDelete: (slotId: string) => void;
}) {
  const icon = slotToIcon(slot.title);
  const colorKey = "green"; // TODO: persist color choice from dialog
  const firstOcc = slot.occurrences[0];
  const totalMin = firstOcc ? getDurationMin(firstOcc) : 0;
  const assignedMin = slot.tasks.reduce((sum, t) => sum + t.durationMinutes, 0);

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4 space-y-3 transition-shadow hover:shadow-md cursor-pointer",
        "bg-white border-gray-100"
      )}
      onClick={() => onEdit(slot)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm leading-tight">{slot.title}</h3>
            <p className="text-xs text-gray-500">{formatRecurrence(slot.recurrence)}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(slot.id);
          }}
          className="rounded-lg p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Time */}
      {firstOcc && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Clock size={12} />
          <span>
            {formatTime(firstOcc.start)} – {formatTime(firstOcc.end)}
          </span>
          <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-medium">
            {formatDuration(totalMin)}
          </span>
        </div>
      )}

      {/* Capacity */}
      {totalMin > 0 && (
        <CapacityBar assignedMin={assignedMin} totalMin={totalMin} colorKey={colorKey} />
      )}

      {/* Tasks summary */}
      {slot.tasks.length > 0 && (
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {slot.tasks.length} lesson{slot.tasks.length !== 1 ? "s" : ""} assigned by coach
        </div>
      )}

      {/* Edit hint */}
      <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
        <span>Tap to edit</span>
        <ChevronRight size={12} />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="rounded-2xl bg-green-50 p-5">
        <Zap size={40} className="text-green-400" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-700 text-base">No training windows yet</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Create your first training window to let your coach plan sessions for you.
        </p>
      </div>
      <Button
        onClick={onAdd}
        className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2"
      >
        <Plus size={16} />
        Create Training Window
      </Button>
    </div>
  );
}

// ─── Weekly Training Budget ───────────────────────────────────────────────────

function WeeklyBudget({ slots }: { slots: SlotData[] }) {
  const weeklyMinutes = slots
    .filter((s) => s.recurrence !== "NONE" || true)
    .reduce((sum, slot) => {
      const occ = slot.occurrences[0];
      if (!occ) return sum;
      return sum + getDurationMin(occ);
    }, 0);

  const assignedMinutes = slots.reduce(
    (sum, slot) => sum + slot.tasks.reduce((s, t) => s + t.durationMinutes, 0),
    0
  );

  const weeklyH = (weeklyMinutes / 60).toFixed(1);
  const assignedH = (assignedMinutes / 60).toFixed(1);
  const remainH = Math.max(0, (weeklyMinutes - assignedMinutes) / 60).toFixed(1);
  const pct = weeklyMinutes > 0 ? Math.min(100, Math.round((assignedMinutes / weeklyMinutes) * 100)) : 0;

  if (weeklyMinutes === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">Weekly Training</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-gray-800">{weeklyH}h</p>
          <p className="text-xs text-gray-500">Available</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-600">{assignedH}h</p>
          <p className="text-xs text-gray-500">Assigned</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-600">{remainH}h</p>
          <p className="text-xs text-gray-500">Remaining</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-500">{pct}% planned</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrainingWindowsView({ userId }: Props) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<SlotData | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getPlayerCalendar(userId);
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      toast.error("Failed to load training windows");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data: TrainingWindowFormData) => {
    await api.createPracticeSlot({
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      recurrence: data.recurrence,
      recurrenceEndDate: data.recurrenceEndDate,
    });
    toast.success("Training window created!");
    await load();
  };

  const handleEdit = async (data: TrainingWindowFormData) => {
    if (!editSlot) return;
    await api.updatePracticeSlot(editSlot.id, {
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      recurrence: data.recurrence,
      recurrenceEndDate: data.recurrenceEndDate ?? null,
    });
    toast.success("Training window updated!");
    await load();
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm("Delete this training window?")) return;
    await api.deletePracticeSlot(slotId);
    toast.success("Training window deleted");
    await load();
  };

  const openEdit = (slot: SlotData) => {
    setEditSlot(slot);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditSlot(null);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading training windows…
      </div>
    );
  }

  const firstOccOfSlot = (slot: SlotData) => slot.occurrences[0];

  return (
    <>
      {/* Weekly Budget summary */}
      {slots.length > 0 && <WeeklyBudget slots={slots} />}

      {/* Window list */}
      {slots.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => (
            <WindowCard
              key={slot.id}
              slot={slot}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Create button */}
          <button
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <Plus size={16} />
            Create Training Window
          </button>
        </div>
      )}

      {/* Dialog */}
      <TrainingWindowDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditSlot(null); }}
        onSubmit={editSlot ? handleEdit : handleCreate}
        mode={editSlot ? "edit" : "create"}
        defaultValues={
          editSlot
            ? {
                title: editSlot.title,
                recurrence: editSlot.recurrence as TrainingWindowFormData["recurrence"],
                startTime: firstOccOfSlot(editSlot)?.start ?? "",
                endTime: firstOccOfSlot(editSlot)?.end ?? "",
                recurrenceEndDate: editSlot.recurrenceEndDate ?? undefined,
                focusAreas: [],
                icon: slotToIcon(editSlot.title),
                color: "green",
              }
            : undefined
        }
      />
    </>
  );
}
