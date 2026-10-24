"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Check, GripVertical, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { DRAG_SOURCE_CLASS } from "@/lib/dnd";
import {
  FOCUS_AREAS,
  FOCUS_AREA_EMOJI,
  type TrainingLesson,
} from "@/lib/lesson-types";
import { cn } from "@/lib/utils";

export type PlannableLesson = Pick<
  TrainingLesson,
  "id" | "name" | "durationMinutes" | "focusArea" | "description"
>;

export const LESSON_DRAG_PREFIX = "cal-lesson:";

function focusLabel(value?: string | null) {
  return FOCUS_AREAS.find((area) => area.value === value)?.label ?? value ?? "";
}

export function lessonMeta(lesson: PlannableLesson) {
  return [
    `${FOCUS_AREA_EMOJI[lesson.focusArea] ?? "📚"} ${focusLabel(lesson.focusArea)}`,
    lesson.durationMinutes ? `${lesson.durationMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function LessonRow({
  lesson,
  armed,
  onArm,
}: {
  lesson: PlannableLesson;
  armed: boolean;
  onArm: (lesson: PlannableLesson | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${LESSON_DRAG_PREFIX}${lesson.id}`,
    data: { lesson },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable"
      aria-label={`${lesson.name}. Drag into the calendar, or tap to pick it and then tap a time.`}
      className={cn(
        "flex min-h-12 cursor-grab items-center gap-2 rounded-lg border bg-white px-2 py-1.5 active:cursor-grabbing",
        DRAG_SOURCE_CLASS,
        armed
          ? "border-[var(--golf-primary)] bg-green-50 ring-1 ring-[var(--golf-primary)]"
          : "border-slate-200 hover:border-slate-300",
        isDragging && "border-dashed opacity-40",
      )}
    >
      <span className="shrink-0 p-1 text-slate-300" aria-hidden>
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={() => onArm(armed ? null : lesson)}
        aria-pressed={armed}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            armed
              ? "border-[var(--golf-primary)] bg-[var(--golf-primary)] text-white"
              : "border-slate-300",
          )}
          aria-hidden
        >
          {armed ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">
            {lesson.name}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {lessonMeta(lesson)}
          </span>
        </span>
      </button>
    </div>
  );
}

/** Lessons to plan in the calendar: drag into a training or a free time. */
export default function LessonLibrary({
  armed,
  onArm,
}: {
  armed: PlannableLesson | null;
  onArm: (lesson: PlannableLesson | null) => void;
}) {
  const [lessons, setLessons] = useState<PlannableLesson[] | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(api.listLessons())
      .then((data: unknown) => {
        if (!cancelled) {
          setLessons(Array.isArray(data) ? (data as PlannableLesson[]) : []);
        }
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const focusAreas = useMemo(
    () =>
      FOCUS_AREAS.filter((area) =>
        (lessons ?? []).some((lesson) => lesson.focusArea === area.value),
      ),
    [lessons],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (lessons ?? [])
      .filter((lesson) => !focus || lesson.focusArea === focus)
      .filter((lesson) => !needle || lesson.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [focus, lessons, query]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="text-xs text-slate-500">
        Drag a lesson onto a team training, or onto a free time to create a
        one-time training. On iPad: press and hold, then drag – or tap a lesson
        and then tap the time.
      </p>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search lessons…"
          className="pl-8"
          aria-label="Search lessons"
        />
      </label>
      {focusAreas.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {focusAreas.map((area) => (
            <button
              key={area.value}
              type="button"
              onClick={() => setFocus(focus === area.value ? null : area.value)}
              aria-pressed={focus === area.value}
              className={cn(
                "min-h-8 rounded-full border px-2 text-xs pointer-coarse:min-h-10",
                focus === area.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600",
              )}
            >
              {FOCUS_AREA_EMOJI[area.value]} {area.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="max-h-[50dvh] space-y-1.5 overflow-y-auto pr-0.5">
        {lessons === null ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No lessons found.
          </p>
        ) : (
          visible.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              armed={armed?.id === lesson.id}
              onArm={onArm}
            />
          ))
        )}
      </div>
    </div>
  );
}
