"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Zap, Trash2, Clock, Users, Pencil } from "lucide-react";
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

type TeamSlotData = {
  id: string;
  ownerType: "PLAYER" | "TEAM";
  teamId?: string | null;
  team?: { id: string; shortName: string; icon?: string | null } | null;
  title: string;
  recurrence: string;
  recurrenceEndDate: string | null;
  occurrences: { start: string; end: string }[];
  tasks: CalendarTask[];
};

type Props = {
  teamId: string;
  teamName: string;
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

const COLOR_KEYS = Object.keys(COLOR_MAP);

function slotToColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length];
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

// ─── Window Card ─────────────────────────────────────────────────────────────

function WindowCard({
  slot,
  onView,
  onEdit,
  onDelete,
}: {
  slot: TeamSlotData;
  onView: (slot: TeamSlotData) => void;
  onEdit: (slot: TeamSlotData) => void;
  onDelete: (slot: TeamSlotData) => void;
}) {
  const icon = slotToIcon(slot.title);
  const firstOcc = slot.occurrences?.[0];
  const totalMin = firstOcc ? getDurationMin(firstOcc) : 0;
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-4 space-y-3 transition-shadow hover:shadow-md cursor-pointer",
        "bg-white border-gray-100"
      )}
      onClick={() => onView(slot)}
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
            onDelete(slot);
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

      {/* Member coverage badge */}
      <div className="flex items-center gap-1.5 text-xs text-blue-600">
        <Users size={12} />
        <span>Team training window</span>
      </div>

      {/* Edit button */}
      <div className="flex items-center justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(slot);
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-green-100 hover:text-green-700 transition-colors"
        >
          <Pencil size={11} />
          Edit
        </button>
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
        <h3 className="font-semibold text-gray-700 text-base">No team training windows yet</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Create a training window for this team. Active members will see it automatically.
        </p>
      </div>
      <Button
        onClick={onAdd}
        className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2"
      >
        <Plus size={16} />
        Create Team Training Window
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TeamTrainingWindowsView({ teamId, teamName }: Props) {
  const [slots, setSlots] = useState<TeamSlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create");
  const [activeSlot, setActiveSlot] = useState<TeamSlotData | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getTeamTrainingWindows(teamId);
      setSlots(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load team training windows");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: TrainingWindowFormData) => {
    await api.createTeamPracticeSlot(teamId, {
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      recurrence: data.recurrence,
      recurrenceEndDate: data.recurrenceEndDate,
    });
    toast.success(`Training window created for ${teamName}.`);
    await load();
  };

  const handleEdit = async (data: TrainingWindowFormData) => {
    if (!activeSlot) return;
    await api.updateTeamPracticeSlot(activeSlot.id, {
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      recurrence: data.recurrence,
      recurrenceEndDate: data.recurrenceEndDate ?? null,
    });
    toast.success("Team training window updated.");
    await load();
  };

  const handleDelete = async (slot: TeamSlotData) => {
    if (!confirm(`Delete training window "${slot.title}" for all team members?`)) return;
    await api.deleteTeamPracticeSlot(slot.id);
    toast.success("Training window removed");
    await load();
  };

  const openView = (slot: TeamSlotData) => {
    setActiveSlot(slot);
    setDialogMode("view");
    setDialogOpen(true);
  };

  const openEdit = (slot: TeamSlotData) => {
    setActiveSlot(slot);
    setDialogMode("edit");
    setDialogOpen(true);
  };

  const openCreate = () => {
    setActiveSlot(null);
    setDialogMode("create");
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading team training windows…
      </div>
    );
  }

  const firstOccOfSlot = (slot: TeamSlotData) => slot.occurrences?.[0];

  return (
    <>
      <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
        Training windows created here are automatically assigned to all team members. Each member will also see them in their personal training windows.
      </div>

      {slots.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => (
            <WindowCard
              key={slot.id}
              slot={slot}
              onView={openView}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          <button
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <Plus size={16} />
            Add Team Training Window
          </button>
        </div>
      )}

      <TrainingWindowDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setActiveSlot(null); }}
        onSubmit={dialogMode === "edit" ? handleEdit : handleCreate}
        onEdit={dialogMode === "view" && activeSlot ? () => openEdit(activeSlot) : undefined}
        mode={dialogMode}
        defaultValues={
          activeSlot
            ? {
                title: activeSlot.title,
                recurrence: activeSlot.recurrence as TrainingWindowFormData["recurrence"],
                startTime: firstOccOfSlot(activeSlot)?.start ?? "",
                endTime: firstOccOfSlot(activeSlot)?.end ?? "",
                recurrenceEndDate: activeSlot.recurrenceEndDate ?? undefined,
                focusAreas: [],
                icon: slotToIcon(activeSlot.title),
                color: "green",
              }
            : undefined
        }
      />
    </>
  );
}
