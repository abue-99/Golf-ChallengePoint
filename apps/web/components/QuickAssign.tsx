"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Loader2, Route as RouteIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { FOCUS_AREAS, type TrainingLesson } from "@/lib/lesson-types";
import type { JourneyTemplate } from "@/types/journey-template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type AssignTarget =
  | { kind: "player"; id: string; name: string }
  | { kind: "team"; id: string; name: string };

type Mode = "lesson" | "journey";
type Priority = "LOW" | "MEDIUM" | "HIGH";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

function focusLabel(value?: string | null) {
  return FOCUS_AREAS.find((area) => area.value === value)?.label ?? value ?? "";
}

/**
 * Assign a lesson or a journey to one player or one team without leaving the
 * coach home. Large touch targets for iPad use.
 */
export default function QuickAssign({
  target,
  onAssigned,
  onCancel,
  loadWarning,
  lessonWarnings,
}: {
  target: AssignTarget;
  onAssigned?: () => void;
  onCancel?: () => void;
  /** e.g. "Max already has 11 h this week (limit 10 h)." */
  loadWarning?: string | null;
  /** lessonId → hint, e.g. "Already open from Ben". */
  lessonWarnings?: Record<string, string>;
}) {
  const [mode, setMode] = useState<Mode>("lesson");
  const [lessons, setLessons] = useState<TrainingLesson[] | null>(null);
  const [journeys, setJourneys] = useState<JourneyTemplate[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(api.listLessons())
      .then((data: unknown) => {
        if (!cancelled) setLessons(Array.isArray(data) ? (data as TrainingLesson[]) : []);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      });
    Promise.resolve(api.listJourneyTemplates())
      .then((data: unknown) => {
        if (!cancelled) setJourneys(Array.isArray(data) ? (data as JourneyTemplate[]) : []);
      })
      .catch(() => {
        if (!cancelled) setJourneys([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (mode === "lesson") {
      return (lessons ?? [])
        .filter(
          (lesson) =>
            !needle ||
            lesson.name.toLowerCase().includes(needle) ||
            focusLabel(lesson.focusArea).toLowerCase().includes(needle),
        )
        .map((lesson) => ({
          id: lesson.id,
          name: lesson.name,
          meta: [focusLabel(lesson.focusArea), lesson.durationMinutes ? `${lesson.durationMinutes} min` : null]
            .filter(Boolean)
            .join(" · "),
        }));
    }
    return (journeys ?? [])
      .filter(
        (journey) =>
          !needle ||
          journey.name.toLowerCase().includes(needle) ||
          (journey.category ?? "").toLowerCase().includes(needle),
      )
      .map((journey) => ({
        id: journey.id,
        name: journey.name,
        meta: [
          `${journey.lessons?.length ?? 0} lessons`,
          journey.difficulty ? journey.difficulty.toLowerCase() : null,
          journey.category,
        ]
          .filter(Boolean)
          .join(" · "),
      }));
  }, [mode, lessons, journeys, query]);

  const loading = mode === "lesson" ? lessons === null : journeys === null;

  function switchMode(next: Mode) {
    setMode(next);
    setSelectedId(null);
    setQuery("");
  }

  async function submit() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      if (mode === "lesson") {
        const payload: Record<string, unknown> = { lessonId: selectedId, priority };
        if (dueDate) payload.dueDate = new Date(`${dueDate}T12:00:00`).toISOString();
        if (target.kind === "player") await api.assignLessonToPlayer(target.id, payload);
        else await api.assignLessonToTeam(target.id, payload);
      } else if (target.kind === "player") {
        await api.assignJourneyToPlayer(selectedId, target.id);
      } else {
        await api.assignJourneyToTeam(selectedId, target.id);
      }
      const name = options.find((option) => option.id === selectedId)?.name ?? "";
      toast.success(`${mode === "lesson" ? "Lesson" : "Journey"} “${name}” assigned to ${target.name}.`);
      setSelectedId(null);
      setDueDate("");
      onAssigned?.();
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "";
      toast.error(message ? `Could not assign: ${message}` : "Could not assign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="What to assign">
        {(
          [
            { value: "lesson", label: "Lesson", icon: BookOpen },
            { value: "journey", label: "Journey", icon: RouteIcon },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
              mode === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "lesson" ? "Search lessons or focus area" : "Search journeys"}
          className="h-10 bg-white pl-9"
          aria-label={mode === "lesson" ? "Search lessons" : "Search journeys"}
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label={mode === "lesson" ? "Lessons" : "Journeys"}>
        {loading ? (
          <p className="flex items-center gap-2 p-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : options.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">
            {query ? "Nothing matches your search." : mode === "lesson" ? "No lessons yet." : "No journeys yet."}
          </p>
        ) : (
          options.map((option) => {
            const selected = option.id === selectedId;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => setSelectedId(selected ? null : option.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0",
                  selected ? "bg-green-50" : "hover:bg-slate-50",
                )}
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
                  <span className="block truncate text-sm font-medium text-slate-800">{option.name}</span>
                  {option.meta ? <span className="block truncate text-xs text-slate-500">{option.meta}</span> : null}
                  {mode === "lesson" && lessonWarnings?.[option.id] ? (
                    <span className="block truncate text-xs font-medium text-amber-700">
                      {lessonWarnings[option.id]}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      {mode === "lesson" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Due date (optional)
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-10 bg-white"
            />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Priority</span>
            <div className="grid h-10 grid-cols-3 gap-1 rounded-md bg-slate-100 p-1" role="group" aria-label="Priority">
              {PRIORITIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  aria-pressed={priority === value}
                  className={cn(
                    "rounded text-xs font-medium",
                    priority === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          The journey is created as a plan for {target.kind === "team" ? "the team" : "the player"} and appears in
          their queue to accept.
        </p>
      )}

      {loadWarning ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{loadWarning}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting} className="h-10">
            Cancel
          </Button>
        ) : null}
        <Button onClick={() => void submit()} disabled={!selectedId || submitting} className="h-10">
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Assign to {target.kind === "team" ? "team" : target.name.split(" ")[0]}
        </Button>
      </div>
    </div>
  );
}

/** QuickAssign in a side sheet, e.g. for a whole team. */
export function QuickAssignSheet({
  target,
  onClose,
  onAssigned,
}: {
  target: AssignTarget;
  onClose: () => void;
  onAssigned?: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-100 p-5 pr-12">
          <SheetTitle>Assign to {target.name}</SheetTitle>
          <SheetDescription>
            {target.kind === "team"
              ? "Every member of the team gets the lesson or journey."
              : "Pick a lesson or a journey for this player."}
          </SheetDescription>
        </SheetHeader>
        <div className="p-5">
          <QuickAssign
            target={target}
            onAssigned={() => {
              onAssigned?.();
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
