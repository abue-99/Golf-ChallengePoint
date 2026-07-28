"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Clock, ChevronRight, ChevronLeft, CalendarDays } from "lucide-react";
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
  ownerType: "PLAYER" | "TEAM";
  playerId?: string | null;
  teamId?: string | null;
  team?: { id: string; shortName: string; icon?: string | null } | null;
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

const COLOR_BAR: Record<string, string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
};

const COLOR_KEYS = Object.keys(COLOR_BAR);

function slotToIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("fitness") || t.includes("gym")) return "🏋";
  if (t.includes("evening") || t.includes("night")) return "🌙";
  if (t.includes("range") || t.includes("driving")) return "⛳";
  if (t.includes("putt")) return "🎯";
  if (t.includes("morning")) return "☀️";
  return "☀️";
}

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

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelectDate,
  activeDates,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  activeDates: Set<string>;
}) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const selKey = selectedDate.toISOString().slice(0, 10);

  return (
    <div className="select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selKey;
          const hasSession = activeDates.has(dateKey);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(new Date(viewYear, viewMonth, day))}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-full text-xs w-7 h-7 mx-auto transition-colors",
                isSelected
                  ? "bg-green-600 text-white font-semibold"
                  : isToday
                  ? "bg-green-100 text-green-700 font-semibold"
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              {day}
              {hasSession && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mobile Date Strip ────────────────────────────────────────────────────────

function MobileDateStrip({
  selectedDate,
  onSelectDate,
  activeDates,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  activeDates: Set<string>;
}) {
  const today = new Date();
  // Show 14 days centred around today
  const days: Date[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });

  const selKey = selectedDate.toISOString().slice(0, 10);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const isSelected = key === selKey;
        const isToday = key === today.toISOString().slice(0, 10);
        const hasSession = activeDates.has(key);

        return (
          <button
            key={key}
            onClick={() => onSelectDate(d)}
            className={cn(
              "flex flex-col items-center flex-shrink-0 rounded-2xl px-2.5 py-2 gap-0.5 transition-colors min-w-[2.75rem]",
              isSelected
                ? "bg-green-600 text-white"
                : isToday
                ? "bg-green-50 text-green-700"
                : "bg-white text-gray-600 hover:bg-gray-50"
            )}
          >
            <span className="text-[10px] font-medium uppercase">{DAY_NAMES[d.getDay()]}</span>
            <span className="text-sm font-semibold leading-tight">{d.getDate()}</span>
            {hasSession ? (
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isSelected ? "bg-white/70" : "bg-green-500"
                )}
              />
            ) : (
              <span className="h-1.5 w-1.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Upcoming Sessions ────────────────────────────────────────────────────────

function UpcomingSessions({ slots }: { slots: SlotData[] }) {
  const now = new Date();

  type UpcomingEntry = {
    title: string;
    icon: string;
    start: Date;
    taskCount: number;
  };

  const upcoming: UpcomingEntry[] = [];
  for (const slot of slots) {
    for (const occ of slot.occurrences) {
      const start = new Date(occ.start);
      if (start >= now) {
        upcoming.push({
          title: slot.title,
          icon: slotToIcon(slot.title),
          start,
          taskCount: slot.tasks.length,
        });
        break; // Only show the next occurrence per slot
      }
    }
  }

  upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());
  const visible = upcoming.slice(0, 5);

  if (visible.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-4">No upcoming sessions</div>
    );
  }

  return (
    <div className="space-y-0">
      {visible.map((entry, i) => {
        const dayLabel = entry.start.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const timeLabel = entry.start.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        return (
          <div key={i} className="py-2.5 border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{entry.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 truncate">{entry.title}</p>
                <p className="text-[10px] text-gray-500">
                  {dayLabel} · {timeLabel}
                  {entry.taskCount > 0 && ` · ${entry.taskCount} lesson${entry.taskCount !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Capacity Bar ─────────────────────────────────────────────────────────────

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
        <span>
          {formatDuration(assignedMin)} assigned · {formatDuration(Math.max(0, totalMin - assignedMin))} remaining
        </span>
        <span className="font-semibold text-gray-700">{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", bar)}
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
  const colorKey = slotToColor(slot.id);
  const firstOcc = slot.occurrences[0];
  const totalMin = firstOcc ? getDurationMin(firstOcc) : 0;
  const assignedMin = slot.tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const isTeamSlot = slot.ownerType === "TEAM";

  return (
    <div
      className="rounded-2xl border-2 border-gray-100 bg-white p-4 space-y-3 transition-all hover:shadow-md hover:border-gray-200 cursor-pointer active:scale-[0.99]"
      onClick={() => onEdit(slot)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{icon}</span>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm leading-tight">{slot.title}</h3>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <p className="text-xs text-gray-400">{formatRecurrence(slot.recurrence)}</p>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                isTeamSlot ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
              )}>
                {isTeamSlot ? `👥 Team${slot.team?.shortName ? ` · ${slot.team.shortName}` : ""}` : "👤 Personal"}
              </span>
            </div>
          </div>
        </div>
        {!isTeamSlot && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
            className="rounded-xl p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
            aria-label="Delete training window"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Time strip */}
      {firstOcc && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Clock size={12} className="flex-shrink-0" />
          <span>
            {formatTime(firstOcc.start)} – {formatTime(firstOcc.end)}
          </span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-medium ml-auto">
            {formatDuration(totalMin)}
          </span>
        </div>
      )}

      {/* Capacity bar */}
      {totalMin > 0 && (
        <CapacityBar assignedMin={assignedMin} totalMin={totalMin} colorKey={colorKey} />
      )}

      {/* Tasks summary */}
      {slot.tasks.length > 0 && (
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {slot.tasks.length} lesson{slot.tasks.length !== 1 ? "s" : ""} planned by coach
        </div>
      )}

      {/* Tap hint */}
      <div className="flex items-center justify-end gap-1 text-[10px] text-gray-300">
        <span>{isTeamSlot ? "Managed by coach" : "Tap to edit"}</span>
        <ChevronRight size={11} />
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4">
      <div className="rounded-3xl bg-green-50 p-6">
        <CalendarDays size={44} className="text-green-400" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-700 text-base">No training windows yet</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Define when you&apos;re available to train. Your coach will schedule lessons into your windows.
        </p>
      </div>
      <Button
        onClick={onAdd}
        className="rounded-2xl bg-green-600 hover:bg-green-700 text-white gap-2 px-6"
      >
        <Plus size={16} />
        Create Training Window
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PlanningHub({ userId }: Props) {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<SlotData | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const data = await api.getPlayerCalendar(userId);
      setSlots(Array.isArray(data?.slots) ? data.slots : []);
    } catch {
      toast.error("Failed to load training windows");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Compute which dates have sessions (for calendar dots)
  const activeDates = new Set<string>();
  for (const slot of slots) {
    for (const occ of slot.occurrences) {
      activeDates.add(occ.start.slice(0, 10));
    }
  }

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
    toast.success("Training window updated");
    await load();
  };

  const handleDelete = async (slotId: string) => {
    if (!confirm("Remove this training window?")) return;
    await api.deletePracticeSlot(slotId);
    toast.success("Training window removed");
    await load();
  };

  const openEdit = (slot: SlotData) => {
    if (slot.ownerType === "TEAM") return;
    setEditSlot(slot);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditSlot(null);
    setDialogOpen(true);
  };

  const firstOccOfSlot = (slot: SlotData) => slot.occurrences[0];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading planning hub…
      </div>
    );
  }

  const selectedMonthLabel = `${MONTH_SHORT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  return (
    <>
      {/* ── Mobile header: date strip ─────────────────────────────────────── */}
      <div className="md:hidden mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
            <CalendarDays size={14} />
            {selectedMonthLabel}
          </h2>
          <Button
            size="sm"
            onClick={openCreate}
            className="rounded-xl bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-xs gap-1"
          >
            <Plus size={12} />
            Window
          </Button>
        </div>
        <MobileDateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          activeDates={activeDates}
        />
      </div>

      {/* ── Desktop header ────────────────────────────────────────────────── */}
      <div className="hidden md:flex items-center justify-between mb-4">
        <div />
        <Button
          onClick={openCreate}
          className="rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          <Plus size={16} />
          Create Window
        </Button>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        {/* Left: Training Windows (primary — 70%) */}
        <div className="flex-1 min-w-0">
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

              <button
                onClick={openCreate}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                <Plus size={16} />
                Add Training Window
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar: Mini calendar + Upcoming (desktop, 30%) */}
        <aside className="hidden md:flex flex-col gap-4 w-[260px] flex-shrink-0">
          {/* Mini calendar */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <MiniCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              activeDates={activeDates}
            />
          </div>

          {/* Upcoming sessions */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Upcoming
            </h3>
            <UpcomingSessions slots={slots} />
          </div>
        </aside>
      </div>

      {/* ── Upcoming sessions: mobile only ───────────────────────────────── */}
      {slots.length > 0 && (
        <div className="md:hidden mt-4 rounded-2xl border border-gray-100 bg-white p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Upcoming
          </h3>
          <UpcomingSessions slots={slots} />
        </div>
      )}

      {/* ── Dialog ──────────────────────────────────────────────────────── */}
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
