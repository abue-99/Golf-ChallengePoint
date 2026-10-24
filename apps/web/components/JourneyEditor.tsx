"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { TrainingLesson } from "@/lib/lesson-types";
import type { JourneyTemplate } from "@/types/journey-template";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DRAG_SOURCE_CLASS, dragStartFeedback, useDragSensors } from "@/lib/dnd";

type LessonDraft = {
  lessonId: string;
  sortOrder: number;
  isRequired: boolean;
};

type FormState = {
  name: string;
  description: string;
  category: string;
  difficulty: "" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  visibility: "PUBLIC" | "PRIVATE";
  coverImageUrl: string;
  lessons: LessonDraft[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "",
  difficulty: "",
  visibility: "PRIVATE",
  coverImageUrl: "",
  lessons: [],
};

const DROPZONE_ID = "journey-lessons-dropzone";

type DragData =
  | { kind: "library"; lessonId: string }
  | { kind: "row"; lessonId: string; index: number };

/**
 * Prefer the row under the finger/pointer. Between rows (or below the last
 * one) but still inside the journey box, snap to the nearest row so the
 * insert line never jumps to the end.
 */
const journeyCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  const hits = pointerHits.length ? pointerHits : rectIntersection(args);
  const slotHits = hits.filter((hit) => String(hit.id).startsWith("slot:"));
  if (slotHits.length) return slotHits;
  if (hits.some((hit) => String(hit.id) === DROPZONE_ID)) {
    const nearest = closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) =>
        String(container.id).startsWith("slot:"),
      ),
    });
    if (nearest.length) return nearest.slice(0, 1);
  }
  return hits;
};

/** Where a drop would land: before or after row `index`. */
type InsertHint = { index: number; after: boolean } | null;

/**
 * Library entry: tap/click adds it to the end of the journey, drag (mouse) or
 * press-and-hold (iPad) places it exactly where it is dropped.
 */
function DraggableLesson({ lesson, onClick }: { lesson: TrainingLesson; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `lesson:${lesson.id}`,
    data: { kind: "library", lessonId: lesson.id } satisfies DragData,
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable"
      aria-label={`${lesson.name}. Drag into the journey.`}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-white text-sm transition-colors",
        "cursor-grab hover:border-slate-300 active:cursor-grabbing",
        DRAG_SOURCE_CLASS,
        isDragging && "border-dashed opacity-40",
      )}
    >
      <GripVertical className="ml-2 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
        title={`Add "${lesson.name}"`}
      >
        <span className="flex-1 truncate">{lesson.name}</span>
        <span className="text-xs text-slate-500">{lesson.durationMinutes}m</span>
      </button>
    </div>
  );
}

/**
 * One lesson inside the journey. The whole row can be dragged to reorder it
 * (grip shows where to grab); it is also a drop target so new lessons and
 * moved rows land right before or after it.
 */
function JourneyLessonRow({
  index,
  lessonId,
  name,
  isRequired,
  hint,
  onToggleRequired,
  onRemove,
}: {
  index: number;
  lessonId: string;
  name: string;
  isRequired: boolean;
  hint: InsertHint;
  onToggleRequired: (value: boolean) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `row:${lessonId}`,
    data: { kind: "row", lessonId, index } satisfies DragData,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: `slot:${index}`, data: { index } });

  const showBefore = hint?.index === index && !hint.after;
  const showAfter = hint?.index === index && hint.after;

  return (
    <div ref={setDropRef} className="relative">
      {showBefore ? <InsertLine position="top" /> : null}
      <div
        ref={(node) => {
          setNodeRef(node);
          setActivatorNodeRef(node);
        }}
        {...attributes}
        {...listeners}
        aria-roledescription="sortable"
        aria-label={`${index + 1}. ${name}. Drag to reorder.`}
        className={cn(
          "flex min-h-11 cursor-grab items-center gap-2 rounded-md border bg-white px-2 py-1 active:cursor-grabbing",
          DRAG_SOURCE_CLASS,
          isDragging && "border-dashed opacity-40",
        )}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
        <span className="flex-1 truncate text-sm">{name}</span>
        <label className="flex min-h-10 cursor-pointer items-center gap-1.5 px-1 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5"
            checked={isRequired}
            onChange={(event) => onToggleRequired(event.target.checked)}
          />
          Required
        </label>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          title="Remove from journey"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {showAfter ? <InsertLine position="bottom" /> : null}
    </div>
  );
}

function InsertLine({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex items-center",
        position === "top" ? "-top-[5px]" : "-bottom-[5px]",
      )}
    >
      <span className="h-2.5 w-2.5 rounded-full border-2 border-green-600 bg-white" />
      <span className="h-0.5 flex-1 bg-green-600" />
    </div>
  );
}

export default function JourneyEditor({ journeyId }: { journeyId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lessonSearch, setLessonSearch] = useState("");

  // Shared drag behaviour: mouse after 6 px, iPad after a 250 ms hold.
  const sensors = useDragSensors();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [insertHint, setInsertHint] = useState<InsertHint>(null);
  const insertHintRef = useRef<InsertHint>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: DROPZONE_ID });

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [lessonData, template] = await Promise.all([
          api.listLessons(),
          journeyId ? api.getJourneyTemplate(journeyId) : Promise.resolve(null),
        ]);
        if (ignore) return;

        setLessons(Array.isArray(lessonData) ? (lessonData as TrainingLesson[]) : []);

        if (template && typeof template === "object") {
          const journey = template as JourneyTemplate;
          setForm({
            name: journey.name,
            description: journey.description ?? "",
            category: journey.category ?? "",
            difficulty: journey.difficulty ?? "",
            visibility: journey.visibility ?? "PRIVATE",
            coverImageUrl: journey.coverImageUrl ?? "",
            lessons: [...journey.lessons]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((entry, index) => ({
                lessonId: entry.lessonId,
                sortOrder: index,
                isRequired: entry.isRequired,
              })),
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [journeyId]);

  const lessonMap = useMemo(
    () => new Map(lessons.map((lesson) => [lesson.id, lesson])),
    [lessons],
  );

  const filteredLessons = useMemo(() => {
    const lower = lessonSearch.toLowerCase();
    return lessons.filter((lesson) => {
      if (form.lessons.some((entry) => entry.lessonId === lesson.id)) return false;
      return !lessonSearch || lesson.name.toLowerCase().includes(lower);
    });
  }, [form.lessons, lessonSearch, lessons]);

  function addLesson(lessonId: string, at?: number) {
    if (!lessonId || form.lessons.some((entry) => entry.lessonId === lessonId)) return;
    setForm((prev) => {
      const next = [...prev.lessons];
      const position = at === undefined ? next.length : Math.max(0, Math.min(at, next.length));
      next.splice(position, 0, { lessonId, sortOrder: position, isRequired: false });
      return { ...prev, lessons: next.map((entry, index) => ({ ...entry, sortOrder: index })) };
    });
  }

  function reorderLesson(from: number, to: number) {
    setForm((prev) => {
      const next = [...prev.lessons];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return {
        ...prev,
        lessons: next.map((entry, index) => ({ ...entry, sortOrder: index })),
      };
    });
  }

  function removeLesson(index: number) {
    setForm((prev) => ({
      ...prev,
      lessons: prev.lessons
        .filter((_, entryIndex) => entryIndex !== index)
        .map((entry, sortOrder) => ({ ...entry, sortOrder })),
    }));
  }

  async function onSave() {
    if (!form.name.trim()) {
      toast.error("Journey name is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      difficulty: form.difficulty || null,
      visibility: form.visibility,
      coverImageUrl: form.coverImageUrl.trim() || null,
      lessons: form.lessons.map((entry, index) => ({
        lessonId: entry.lessonId,
        sortOrder: index,
        isRequired: entry.isRequired,
      })),
    };

    setSaving(true);
    try {
      if (journeyId) {
        await api.updateJourneyTemplate(journeyId, payload);
        toast.success("Journey updated.");
      } else {
        await api.createJourneyTemplate(payload);
        toast.success("Journey created.");
      }
      router.push("/coach/journeys");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save journey.");
    } finally {
      setSaving(false);
    }
  }

  function setHint(next: InsertHint) {
    const current = insertHintRef.current;
    if (current?.index === next?.index && current?.after === next?.after) return;
    insertHintRef.current = next;
    setInsertHint(next);
  }

  /** Works out before/after from where the dragged item's centre is. */
  function hintFor(event: DragMoveEvent | DragEndEvent): InsertHint {
    const over = event.over;
    if (!over) return null;
    if (String(over.id) === DROPZONE_ID) {
      return form.lessons.length ? { index: form.lessons.length - 1, after: true } : null;
    }
    const index = (over.data.current as { index?: number } | undefined)?.index;
    if (index === undefined) return null;
    const dragged = event.active.rect.current.translated;
    const centre = dragged ? dragged.top + dragged.height / 2 : over.rect.top;
    return { index, after: centre > over.rect.top + over.rect.height / 2 };
  }

  function onDragStart(event: DragStartEvent) {
    dragStartFeedback();
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
  }

  function onDragMove(event: DragMoveEvent) {
    setHint(hintFor(event));
  }

  function resetDrag() {
    setActiveDrag(null);
    setHint(null);
  }

  function onDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as DragData | undefined;
    const hint = hintFor(event);
    resetDrag();
    if (!data || !event.over) return;

    // Target position in the list as it is before the move.
    const target = hint ? hint.index + (hint.after ? 1 : 0) : form.lessons.length;

    if (data.kind === "library") {
      addLesson(data.lessonId, target);
      return;
    }

    const from = form.lessons.findIndex((entry) => entry.lessonId === data.lessonId);
    if (from < 0) return;
    const to = target > from ? target - 1 : target;
    if (to !== from) reorderLesson(from, to);
  }

  const activeLessonName = activeDrag ? lessonMap.get(activeDrag.lessonId)?.name ?? "" : "";

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading journey…</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={journeyCollision}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
    >
      <div className="space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {journeyId ? "Edit Journey" : "New Journey"}
            </h1>
            <p className="text-sm text-slate-500">
              Build journey details and add lessons from the library.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/coach/journeys")}>Cancel</Button>
            <Button className="bg-green-600 text-white hover:bg-green-500" onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : journeyId ? "Save Journey" : "Create Journey"}
            </Button>
          </div>
        </header>

        {/* Side by side from iPad landscape up, so lessons can be dragged across without scrolling. */}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Journey name"
            />
            <Textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Description"
              rows={3}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Category"
              />
              <select
                className="h-9 w-full rounded-md border px-3 text-sm"
                value={form.difficulty}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, difficulty: event.target.value as FormState["difficulty"] }))
                }
              >
                <option value="">Difficulty</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="h-9 w-full rounded-md border px-3 text-sm"
                value={form.visibility}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, visibility: event.target.value as "PUBLIC" | "PRIVATE" }))
                }
              >
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
              </select>
              <Input
                value={form.coverImageUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, coverImageUrl: event.target.value }))}
                placeholder="Cover image URL"
              />
            </div>

            <div
              ref={setDropRef}
              className={cn(
                "space-y-2 rounded-lg border p-3",
                activeDrag && "border-dashed border-green-400",
                (isOver || insertHint) && "bg-green-50/60",
              )}
            >
              <p className="text-xs text-slate-500">
                Drag lessons here or tap them in the library. Drag a row to change the order.
              </p>
              {form.lessons.length === 0 ? (
                <p
                  className={cn(
                    "rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground",
                    activeDrag && "border-green-400 text-green-700",
                  )}
                >
                  No lessons added yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {form.lessons.map((entry, index) => (
                    <JourneyLessonRow
                      key={entry.lessonId}
                      index={index}
                      lessonId={entry.lessonId}
                      name={lessonMap.get(entry.lessonId)?.name ?? entry.lessonId}
                      isRequired={entry.isRequired}
                      hint={insertHint}
                      onToggleRequired={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          lessons: prev.lessons.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, isRequired: value } : item,
                          ),
                        }))
                      }
                      onRemove={() => removeLesson(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-white p-4 shadow-sm lg:sticky lg:top-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={lessonSearch}
                onChange={(event) => setLessonSearch(event.target.value)}
                placeholder="Search lessons…"
                className="pl-8"
              />
            </div>
            <p className="text-xs text-slate-500">
              Lesson library: tap to add, or drag into the journey
              <span className="hidden pointer-coarse:inline"> (press and hold, then drag)</span>.
            </p>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
              {filteredLessons.length === 0 ? (
                <p className="text-xs text-slate-500">No lessons available.</p>
              ) : (
                filteredLessons.map((lesson) => (
                  <DraggableLesson key={lesson.id} lesson={lesson} onClick={() => addLesson(lesson.id)} />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {activeDrag ? (
          <div className="flex w-72 rotate-1 scale-105 items-center gap-2 rounded-md border border-green-600 bg-white px-3 py-2 text-sm font-medium shadow-2xl ring-4 ring-green-600/15">
            <GripVertical className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
            <span className="truncate">{activeLessonName}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
