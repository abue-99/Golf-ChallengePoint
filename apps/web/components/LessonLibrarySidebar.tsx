"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  getFocusAreaPath,
  FOCUS_AREA_EMOJI,
  type TrainingLesson,
} from "@/lib/lesson-types";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Draggable single lesson card ──────────────────────────────────────────────

function DraggableLessonCard({
  lesson,
  onLessonClick,
}: {
  lesson: TrainingLesson;
  onLessonClick?: (lesson: TrainingLesson) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `lesson:${lesson.id}`,
      data: { lesson },
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "group flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-50 ring-2 ring-primary",
      )}
      title={`Drag to assign "${lesson.name}"`}
      onClick={() => onLessonClick?.(lesson)}
    >
      <div {...attributes} {...listeners} className="flex items-center flex-1 gap-2 min-w-0">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-80" />
        <span className="truncate flex-1">{lesson.name}</span>
      </div>
      {lesson.durationMinutes ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {lesson.durationMinutes}m
        </span>
      ) : null}
      {onLessonClick && (
        <button
          type="button"
          className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            onLessonClick(lesson);
          }}
          title="Quick-assign"
        >
          Assign
        </button>
      )}
    </div>
  );
}

// ── Focus-area section with collapse ─────────────────────────────────────────

function FocusSection({
  label,
  emoji,
  lessons,
  defaultOpen,
  onLessonClick,
}: {
  label: string;
  emoji: string;
  lessons: TrainingLesson[];
  defaultOpen?: boolean;
  onLessonClick?: (lesson: TrainingLesson) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span>{emoji}</span>
        <span>{label}</span>
        <span className="ml-auto font-normal normal-case">
          ({lessons.length})
        </span>
      </button>

      {open && (
        <div className="ml-1 mt-0.5 space-y-1 pb-1">
          {lessons.map((l) => (
            <DraggableLessonCard key={l.id} lesson={l} onLessonClick={onLessonClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

type Props = {
  /** When true the sidebar renders as a floating panel; when false it is inline */
  floating?: boolean;
  onClose?: () => void;
  /** Called when user clicks a lesson card (non-DnD quick-assign fallback) */
  onLessonClick?: (lesson: TrainingLesson) => void;
  inlineFullWidth?: boolean;
};

export default function LessonLibrarySidebar({
  floating = false,
  onClose,
  onLessonClick,
  inlineFullWidth = false,
}: Props) {
  const [lessons, setLessons] = useState<TrainingLesson[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.listLessons().then((data: TrainingLesson[] | unknown) => {
      setLessons(Array.isArray(data) ? data : []);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!lessons) return [];
    const lower = q.toLowerCase();
    return lessons.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(lower) ||
        getFocusAreaPath(l.focusArea, l.subCapability).toLowerCase().includes(lower),
    );
  }, [lessons, q]);

  const byArea = useMemo(() => {
    const map = new Map<string, TrainingLesson[]>();
    for (const lesson of filtered) {
      const arr = map.get(lesson.focusArea) ?? [];
      arr.push(lesson);
      map.set(lesson.focusArea, arr);
    }
    return map;
  }, [filtered]);

  return (
    <aside
      className={cn(
        "flex flex-col bg-background border-border",
        floating
          ? "fixed right-0 top-0 h-full w-72 border-l shadow-xl z-40"
          : inlineFullWidth
            ? "h-full w-full border-0"
            : "h-full w-64 border-r",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">Lesson Library</span>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lessons…"
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Drag hint */}
      <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-b">
        Drag a lesson onto a player, team, or queue to assign it. Tap to use
        quick-assign on touch devices.
      </p>

      {/* Lesson list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {lessons === null ? (
          <p className="text-xs text-muted-foreground px-1">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No lessons found.</p>
        ) : (
          FOCUS_AREAS.filter((fa) => byArea.has(fa.value)).map((fa, idx) => (
            <FocusSection
              key={fa.value}
              label={fa.label}
              emoji={FOCUS_AREA_EMOJI[fa.value] ?? "📚"}
              lessons={byArea.get(fa.value) ?? []}
              defaultOpen={idx === 0 && !q}
              onLessonClick={onLessonClick}
            />
          ))
        )}
      </div>
    </aside>
  );
}
