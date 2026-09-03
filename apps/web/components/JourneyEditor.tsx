"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, TouchSensor, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { TrainingLesson } from "@/lib/lesson-types";
import type { JourneyTemplate } from "@/types/journey-template";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

function DraggableLesson({ lesson, onClick }: { lesson: TrainingLesson; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lesson:${lesson.id}`,
    data: { lessonId: lesson.id },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "w-full rounded-md border bg-white px-2 py-1.5 text-left text-sm transition-shadow",
        "cursor-grab active:cursor-grabbing",
        isDragging && "z-50 scale-[1.02] shadow-xl ring-2 ring-green-500",
      )}
      onClick={onClick}
      title={`Drag or tap to add \"${lesson.name}\"`}
    >
      <div {...attributes} {...listeners} className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-slate-400" />
        <span className="truncate flex-1">{lesson.name}</span>
        <span className="text-xs text-slate-500">{lesson.durationMinutes}m</span>
      </div>
    </button>
  );
}

export default function JourneyEditor({ journeyId }: { journeyId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lessonSearch, setLessonSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: "journey-lessons-dropzone" });

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

  function addLesson(lessonId: string) {
    if (!lessonId || form.lessons.some((entry) => entry.lessonId === lessonId)) return;
    setForm((prev) => ({
      ...prev,
      lessons: [...prev.lessons, { lessonId, sortOrder: prev.lessons.length, isRequired: false }],
    }));
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

  async function onDragEnd(event: DragEndEvent) {
    if (String(event.over?.id) !== "journey-lessons-dropzone") return;
    const lessonId = (event.active.data.current as { lessonId?: string } | undefined)?.lessonId;
    if (!lessonId) return;
    addLesson(lessonId);
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading journey…</div>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
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
                isOver && "border-green-400 bg-green-50",
              )}
            >
              <p className="text-xs text-slate-500">Drop lessons here or tap from the right list.</p>
              {form.lessons.length === 0 ? (
                <p className="text-xs text-muted-foreground">No lessons added yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {form.lessons.map((entry, index) => {
                    const lesson = lessonMap.get(entry.lessonId);
                    return (
                      <div key={`${entry.lessonId}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                        <span className="text-xs text-muted-foreground w-5">{index + 1}</span>
                        <span className="text-sm flex-1 truncate">{lesson?.name ?? entry.lessonId}</span>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={entry.isRequired}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                lessons: prev.lessons.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, isRequired: event.target.checked } : item,
                                ),
                              }))
                            }
                          />
                          Required
                        </label>
                        <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => reorderLesson(index, index - 1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={index === form.lessons.length - 1} onClick={() => reorderLesson(index, index + 1)}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeLesson(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={lessonSearch}
                onChange={(event) => setLessonSearch(event.target.value)}
                placeholder="Search lessons…"
                className="pl-8"
              />
            </div>
            <p className="text-xs text-slate-500">Lesson library (drag or tap to add)</p>
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
    </DndContext>
  );
}
