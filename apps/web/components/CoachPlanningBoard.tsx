"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Clock, Target, CheckCircle2, GripVertical } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lesson = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes?: number | null;
  focusArea?: string | null;
  subCapability?: string | null;
};

type SlotTask = {
  id: string;
  title: string;
  durationMinutes: number;
  scheduledDate: string;
};

type TrainingWindow = {
  id: string;
  title: string;
  recurrence: string;
  occurrences: { start: string; end: string }[];
  tasks: SlotTask[];
};

type Props = {
  playerId: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function getDurationMin(occ: { start: string; end: string }): number {
  return Math.round((new Date(occ.end).getTime() - new Date(occ.start).getTime()) / 60000);
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatRecurrence(rec: string): string {
  if (rec === "NONE") return "One-time";
  if (rec === "WEEKLY") return "Every week";
  if (rec === "MONTHLY") return "Every month";
  return rec;
}

function slotToIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("fitness") || t.includes("gym")) return "🏋";
  if (t.includes("evening") || t.includes("night")) return "🌙";
  if (t.includes("range") || t.includes("driving")) return "⛳";
  if (t.includes("putt")) return "🎯";
  return "☀️";
}

function focusAreaIcon(area?: string | null): string {
  if (!area) return "🎯";
  const a = area.toLowerCase();
  if (a.includes("putt")) return "🎯";
  if (a.includes("short")) return "⛳";
  if (a.includes("long") || a.includes("driv")) return "🏌️";
  if (a.includes("fit")) return "💪";
  if (a.includes("mental") || a.includes("focus")) return "🧠";
  if (a.includes("approach")) return "🎯";
  return "📋";
}

// ─── Lesson card (draggable) ──────────────────────────────────────────────────

function LessonCard({
  lesson,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lesson: Lesson;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(lesson.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-xl border-2 bg-white p-3 cursor-grab select-none transition-all",
        isDragging
          ? "opacity-50 border-blue-300 shadow-lg scale-95"
          : "border-gray-100 hover:border-blue-300 hover:shadow-md active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-gray-300 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{focusAreaIcon(lesson.focusArea)}</span>
            <h4 className="font-medium text-gray-800 text-sm truncate">{lesson.name}</h4>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {lesson.durationMinutes != null && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {lesson.durationMinutes} min
              </span>
            )}
            {lesson.focusArea && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">
                {lesson.focusArea}
              </span>
            )}
          </div>
          {lesson.description && (
            <p className="mt-1 text-xs text-gray-400 line-clamp-1">{lesson.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Training window (drop target) ───────────────────────────────────────────

function WindowDropZone({
  window: win,
  isOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  window: TrainingWindow;
  isOver: boolean;
  onDragEnter: (windowId: string) => void;
  onDragLeave: (windowId: string) => void;
  onDrop: (windowId: string) => void;
}) {
  // Use a counter to track nested dragenter/dragleave events so that
  // entering a child element does not incorrectly clear the "over" state.
  const enterCount = useRef(0);

  const firstOcc = win.occurrences[0];
  const totalMin = firstOcc ? getDurationMin(firstOcc) : 0;
  const assignedMin = win.tasks.reduce((s, t) => s + t.durationMinutes, 0);
  const remainMin = Math.max(0, totalMin - assignedMin);
  const pct = totalMin > 0 ? Math.min(100, Math.round((assignedMin / totalMin) * 100)) : 0;

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    enterCount.current += 1;
    if (enterCount.current === 1) {
      onDragEnter(win.id);
    }
  };

  const handleDragLeave = () => {
    enterCount.current -= 1;
    if (enterCount.current === 0) {
      onDragLeave(win.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    enterCount.current = 0;
    onDrop(win.id);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "rounded-2xl border-2 p-4 space-y-3 transition-all",
        isOver
          ? "border-blue-400 bg-blue-50 shadow-lg scale-[1.01]"
          : "border-gray-100 bg-white hover:border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{slotToIcon(win.title)}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 text-sm">{win.title}</h3>
          <p className="text-xs text-gray-500">{formatRecurrence(win.recurrence)}</p>
        </div>
        {isOver && (
          <span className="text-xs text-blue-600 font-medium animate-pulse">Drop here</span>
        )}
      </div>

      {/* Time info */}
      {firstOcc && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Clock size={11} />
          <span>
            {formatDate(firstOcc.start)} · {formatTime(firstOcc.start)} – {formatTime(firstOcc.end)}
          </span>
        </div>
      )}

      {/* Capacity bar */}
      {totalMin > 0 && (
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-green-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{assignedMin} min assigned</span>
            <span className="font-medium text-green-700">{formatDuration(remainMin)} free</span>
          </div>
        </div>
      )}

      {/* Assigned lessons */}
      {win.tasks.length > 0 ? (
        <div className="space-y-1">
          {win.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"
            >
              <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
              <span className="flex-1 truncate">{task.title}</span>
              <span className="text-gray-400">{task.durationMinutes} min</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          "rounded-xl border-2 border-dashed py-4 text-center text-xs text-gray-400 transition-colors",
          isOver ? "border-blue-300 text-blue-500 bg-blue-50" : "border-gray-200"
        )}>
          {isOver ? "Release to assign" : "Drag a lesson here to assign"}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachPlanningBoard({ playerId }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [windows, setWindows] = useState<TrainingWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overWindowId, setOverWindowId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [lessonsData, calendarData] = await Promise.all([
        api.listLessons(),
        api.getPlayerCalendar(playerId),
      ]);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
      setWindows(Array.isArray(calendarData.slots) ? calendarData.slots : []);
    } catch {
      toast.error("Failed to load planning board");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDragStart = (lessonId: string) => {
    setDraggingId(lessonId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverWindowId(null);
  };

  const handleWindowDragEnter = (windowId: string) => {
    setOverWindowId(windowId);
  };

  const handleWindowDragLeave = (windowId: string) => {
    setOverWindowId((prev) => (prev === windowId ? null : prev));
  };

  const handleDrop = async (windowId: string) => {
    if (!draggingId || assigning) return;
    const lesson = lessons.find((l) => l.id === draggingId);
    const win = windows.find((w) => w.id === windowId);
    if (!lesson || !win) return;

    setDraggingId(null);
    setOverWindowId(null);
    setAssigning(true);

    try {
      // Use the first upcoming occurrence as the scheduled date
      const occ = win.occurrences[0];
      const scheduledDate = occ
        ? new Date(occ.start).toISOString()
        : new Date().toISOString();

      await api.assignTask(windowId, {
        title: lesson.name,
        description: lesson.description ?? "",
        durationMinutes: lesson.durationMinutes ?? 30,
        scheduledDate,
      });

      toast.success(`"${lesson.name}" assigned to ${win.title}`);
      await load();
    } catch {
      toast.error("Failed to assign lesson");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading planning board…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Touch-friendly info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 flex items-center gap-2">
        <Target size={14} className="flex-shrink-0" />
        <span>Drag a lesson from the left onto a training window to assign it.</span>
      </div>

      {assigning && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700 text-center animate-pulse">
          Assigning lesson…
        </div>
      )}

      {/* Board layout: 2-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Lessons ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-1 rounded-full bg-blue-500" />
            <h2 className="font-semibold text-gray-800">Available Lessons</h2>
            <span className="text-xs text-gray-400">({lessons.length})</span>
          </div>

          {lessons.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              No lessons found. Create lessons in the Lessons tab first.
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  isDragging={draggingId === lesson.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Training Windows ────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-1 rounded-full bg-green-500" />
            <h2 className="font-semibold text-gray-800">Training Windows</h2>
            <span className="text-xs text-gray-400">({windows.length})</span>
          </div>

          {windows.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              <p>This player has no training windows yet.</p>
              <p className="mt-1 text-xs">Ask the player to create their availability windows first.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
              {windows.map((win) => (
                <WindowDropZone
                  key={win.id}
                  window={win}
                  isOver={overWindowId === win.id}
                  onDragEnter={handleWindowDragEnter}
                  onDragLeave={handleWindowDragLeave}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
