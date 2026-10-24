"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { BookOpen, Check, Clock, GripVertical, Route as RouteIcon, Search } from "lucide-react";
import { api } from "@/lib/api";
import { FOCUS_AREAS, FOCUS_AREA_EMOJI, type TrainingLesson } from "@/lib/lesson-types";
import type { JourneyTemplate } from "@/types/journey-template";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DRAG_SOURCE_CLASS } from "@/lib/dnd";

export type LibraryItem =
  | { type: "lesson"; lesson: TrainingLesson }
  | { type: "journey"; journey: JourneyTemplate };

export function libraryItemKey(item: LibraryItem) {
  return item.type === "lesson" ? `lesson:${item.lesson.id}` : `journey:${item.journey.id}`;
}

export function libraryItemName(item: LibraryItem) {
  return item.type === "lesson" ? item.lesson.name : item.journey.name;
}

const RECENT_KEY = "teams.recentAssignments";
const MAX_RECENT = 5;

function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/** Remember an item as recently assigned (per browser). */
export function rememberRecent(item: LibraryItem) {
  try {
    const key = libraryItemKey(item);
    const next = [key, ...readRecent().filter((entry) => entry !== key)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("teams-recent-changed"));
  } catch {
    // Storage unavailable – recents just aren't remembered.
  }
}

function focusLabel(value?: string | null) {
  return FOCUS_AREAS.find((area) => area.value === value)?.label ?? value ?? "";
}

function difficultyLabel(value: JourneyTemplate["difficulty"]) {
  if (value === "BEGINNER") return "Beginner";
  if (value === "INTERMEDIATE") return "Intermediate";
  if (value === "ADVANCED") return "Advanced";
  return null;
}

/**
 * One library entry: tap to select it for assigning, or drag it onto a
 * team/player card (the ids match the DndLessonProvider conventions).
 */
function LibraryRow({
  item,
  selected,
  onSelect,
  idPrefix = "",
}: {
  item: LibraryItem;
  selected: boolean;
  onSelect: (item: LibraryItem) => void;
  /** Draggable ids must be unique; the provider reads the item from `data`. */
  idPrefix?: string;
}) {
  const key = libraryItemKey(item);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `${idPrefix}${key}`,
    data: item.type === "lesson" ? { lesson: item.lesson } : { journeyTemplate: item.journey },
  });

  const meta =
    item.type === "lesson"
      ? [
          `${FOCUS_AREA_EMOJI[item.lesson.focusArea] ?? "📚"} ${focusLabel(item.lesson.focusArea)}`,
          item.lesson.durationMinutes ? `${item.lesson.durationMinutes} min` : null,
        ]
      : [
          `${item.journey.lessons?.length ?? 0} lesson${item.journey.lessons?.length === 1 ? "" : "s"}`,
          difficultyLabel(item.journey.difficulty),
          item.journey.category,
        ];

  return (
    // The whole row is the drag source: drag with the mouse, or press and
    // hold on iPad. The floating copy comes from the DragOverlay in
    // DndLessonProvider, so the row itself stays in place as a placeholder.
    <div
      ref={(node) => {
        setNodeRef(node);
        // Keyboard drags start only on the row itself, so Enter on the inner
        // select button keeps selecting instead of picking the row up.
        setActivatorNodeRef(node);
      }}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable"
      aria-label={`${libraryItemName(item)}. Drag onto a team or player.`}
      className={cn(
        "flex min-h-12 cursor-grab items-center gap-2 rounded-lg border bg-white px-2 py-1.5 transition-colors active:cursor-grabbing",
        DRAG_SOURCE_CLASS,
        selected ? "border-[var(--golf-primary)] bg-green-50 ring-1 ring-[var(--golf-primary)]" : "border-slate-200 hover:border-slate-300",
        isDragging && "border-dashed opacity-40",
      )}
    >
      <span className="shrink-0 p-1 text-slate-300" aria-hidden="true">
        <GripVertical className="h-4 w-4" />
      </span>
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-[var(--golf-primary)] bg-[var(--golf-primary)] text-white" : "border-slate-300",
          )}
          aria-hidden="true"
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">{libraryItemName(item)}</span>
          <span className="block truncate text-xs text-slate-500">{meta.filter(Boolean).join(" · ")}</span>
        </span>
      </button>
    </div>
  );
}

type Mode = "lesson" | "journey";

/** Lessons and journeys to assign: search, focus filter, recently used. */
export default function AssignLibrary({
  armed,
  onArm,
}: {
  armed: LibraryItem | null;
  onArm: (item: LibraryItem | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("lesson");
  const [lessons, setLessons] = useState<TrainingLesson[] | null>(null);
  const [journeys, setJourneys] = useState<JourneyTemplate[] | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(api.listLessons())
      .then((data: unknown) => {
        if (!cancelled) setLessons(Array.isArray(data) ? (data as TrainingLesson[]) : []);
      })
      .catch(() => !cancelled && setLessons([]));
    Promise.resolve(api.listJourneyTemplates())
      .then((data: unknown) => {
        if (!cancelled) setJourneys(Array.isArray(data) ? (data as JourneyTemplate[]) : []);
      })
      .catch(() => !cancelled && setJourneys([]));
    const syncRecent = () => setRecent(readRecent());
    syncRecent();
    window.addEventListener("teams-recent-changed", syncRecent);
    return () => {
      cancelled = true;
      window.removeEventListener("teams-recent-changed", syncRecent);
    };
  }, []);

  const allItems = useMemo(() => {
    const map = new Map<string, LibraryItem>();
    (lessons ?? []).forEach((lesson) => map.set(`lesson:${lesson.id}`, { type: "lesson", lesson }));
    (journeys ?? []).forEach((journey) => map.set(`journey:${journey.id}`, { type: "journey", journey }));
    return map;
  }, [lessons, journeys]);

  const recentItems = recent
    .map((key) => allItems.get(key))
    .filter((item): item is LibraryItem => Boolean(item) && item?.type === mode);

  const focusAreas = useMemo(
    () => FOCUS_AREAS.filter((area) => (lessons ?? []).some((lesson) => lesson.focusArea === area.value)),
    [lessons],
  );

  const items = useMemo<LibraryItem[]>(() => {
    const needle = query.trim().toLowerCase();
    if (mode === "lesson") {
      return (lessons ?? [])
        .filter((lesson) => !focus || lesson.focusArea === focus)
        .filter(
          (lesson) =>
            !needle ||
            lesson.name.toLowerCase().includes(needle) ||
            focusLabel(lesson.focusArea).toLowerCase().includes(needle) ||
            (lesson.subCapability ?? "").toLowerCase().includes(needle),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((lesson) => ({ type: "lesson" as const, lesson }));
    }
    return (journeys ?? [])
      .filter(
        (journey) =>
          !needle ||
          journey.name.toLowerCase().includes(needle) ||
          (journey.category ?? "").toLowerCase().includes(needle) ||
          (journey.description ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((journey) => ({ type: "journey" as const, journey }));
  }, [mode, lessons, journeys, query, focus]);

  const loading = mode === "lesson" ? lessons === null : journeys === null;
  const armedKey = armed ? libraryItemKey(armed) : null;

  function toggle(item: LibraryItem) {
    onArm(armedKey === libraryItemKey(item) ? null : item);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Library">
        {(
          [
            { value: "lesson", label: "Lessons", icon: BookOpen, count: lessons?.length },
            { value: "journey", label: "Journeys", icon: RouteIcon, count: journeys?.length },
          ] as const
        ).map(({ value, label, icon: Icon, count }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value);
              setQuery("");
            }}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium pointer-coarse:h-11",
              mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
            {typeof count === "number" ? <span className="text-xs font-normal text-slate-400">{count}</span> : null}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "lesson" ? "Search lessons" : "Search journeys"}
          className="h-9 bg-white pl-9 pointer-coarse:h-11"
          aria-label={mode === "lesson" ? "Search lessons" : "Search journeys"}
        />
      </div>

      {mode === "lesson" && focusAreas.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Focus area">
          <button
            type="button"
            onClick={() => setFocus(null)}
            aria-pressed={focus === null}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs pointer-coarse:px-3 pointer-coarse:py-1.5",
              focus === null ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600",
            )}
          >
            All
          </button>
          {focusAreas.map((area) => (
            <button
              key={area.value}
              type="button"
              onClick={() => setFocus(focus === area.value ? null : area.value)}
              aria-pressed={focus === area.value}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs pointer-coarse:px-3 pointer-coarse:py-1.5",
                focus === area.value
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-600",
              )}
            >
              {FOCUS_AREA_EMOJI[area.value] ?? ""} {area.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {recentItems.length > 0 && !query && !focus ? (
          <section className="space-y-1.5">
            <h3 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Clock className="h-3 w-3" /> Recently used
            </h3>
            {recentItems.map((item) => (
              <LibraryRow
                key={`recent-${libraryItemKey(item)}`}
                item={item}
                selected={armedKey === libraryItemKey(item)}
                onSelect={toggle}
                idPrefix="recent-"
              />
            ))}
          </section>
        ) : null}

        <section className="space-y-1.5">
          {recentItems.length > 0 && !query && !focus ? (
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {mode === "lesson" ? "All lessons" : "All journeys"}
            </h3>
          ) : null}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">
              {query || focus ? "Nothing matches." : mode === "lesson" ? "No lessons yet." : "No journeys yet."}
            </p>
          ) : (
            items.map((item) => (
              <LibraryRow
                key={libraryItemKey(item)}
                item={item}
                selected={armedKey === libraryItemKey(item)}
                onSelect={toggle}
              />
            ))
          )}
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Tap an entry, then tap teams and players to assign it to all of them at once.
        <span className="hidden pointer-fine:inline"> You can also drag it onto a card.</span>
        <span className="hidden pointer-coarse:inline"> Or press and hold an entry, then drag it onto a card.</span>
      </p>
    </div>
  );
}
