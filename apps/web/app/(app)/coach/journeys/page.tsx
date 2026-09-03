"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Copy, Trash2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "@/lib/api";
import type { JourneyTemplate } from "@/types/journey-template";
import type { TrainingLesson } from "@/lib/lesson-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  coverImageUrl: string;
  lessons: LessonDraft[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "",
  difficulty: "",
  coverImageUrl: "",
  lessons: [],
};

export default function CoachJourneyTemplatesPage() {
  const [templates, setTemplates] = useState<JourneyTemplate[]>([]);
  const [lessons, setLessons] = useState<TrainingLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadData() {
    setLoading(true);
    try {
      const [journeyData, lessonData] = await Promise.all([
        api.listJourneyTemplates(),
        api.listLessons(),
      ]);
      setTemplates(Array.isArray(journeyData) ? (journeyData as JourneyTemplate[]) : []);
      setLessons(Array.isArray(lessonData) ? (lessonData as TrainingLesson[]) : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const lessonMap = useMemo(
    () => new Map(lessons.map((lesson) => [lesson.id, lesson])),
    [lessons],
  );

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedLessonId("");
  }

  function startEditing(template: JourneyTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      description: template.description ?? "",
      category: template.category ?? "",
      difficulty: template.difficulty ?? "",
      coverImageUrl: template.coverImageUrl ?? "",
      lessons: template.lessons
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((entry, index) => ({
          lessonId: entry.lessonId,
          sortOrder: entry.sortOrder ?? index,
          isRequired: entry.isRequired,
        })),
    });
  }

  function addLessonToForm() {
    if (!selectedLessonId) return;
    setForm((prev) => ({
      ...prev,
      lessons: [
        ...prev.lessons,
        {
          lessonId: selectedLessonId,
          sortOrder: prev.lessons.length,
          isRequired: false,
        },
      ],
    }));
  }

  function reorderLessons(from: number, to: number) {
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
        .filter((_, i) => i !== index)
        .map((entry, idx) => ({ ...entry, sortOrder: idx })),
    }));
  }

  async function saveTemplate() {
    if (!form.name.trim()) {
      toast.error("Template name is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      difficulty: form.difficulty || null,
      coverImageUrl: form.coverImageUrl.trim() || null,
      lessons: form.lessons.map((entry, index) => ({
        lessonId: entry.lessonId,
        sortOrder: index,
        isRequired: entry.isRequired,
      })),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.updateJourneyTemplate(editingId, payload);
        toast.success("Journey template updated.");
      } else {
        await api.createJourneyTemplate(payload);
        toast.success("Journey template created.");
      }
      await loadData();
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(id: string) {
    try {
      await api.duplicateJourneyTemplate(id);
      toast.success("Journey template duplicated.");
      await loadData();
    } catch {
      toast.error("Failed to duplicate template.");
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this journey template?")) return;
    try {
      await api.deleteJourneyTemplate(id);
      toast.success("Journey template deleted.");
      if (editingId === id) resetForm();
      await loadData();
    } catch {
      toast.error("Failed to delete template.");
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Journey Templates</h1>
        <p className="text-sm text-muted-foreground">
          Build reusable training journeys and assign them to players or teams.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Template Library</h2>
            <Button variant="outline" size="sm" onClick={resetForm}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No journey templates yet.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <article key={template.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {template.category ?? "Uncategorized"} · {template.difficulty ?? "No level"}
                      </p>
                      <p className="text-xs text-emerald-700 mt-1">
                        {template.lessons.length} lesson{template.lessons.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEditing(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => duplicateTemplate(template.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteTemplate(template.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-semibold">Journey Builder</h2>
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Template name"
          />
          <Textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            rows={3}
          />
          <Input
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Category"
          />
          <select
            className="h-9 w-full rounded-md border px-3 text-sm"
            value={form.difficulty}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                difficulty: e.target.value as FormState["difficulty"],
              }))
            }
          >
            <option value="">Difficulty</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
          <Input
            value={form.coverImageUrl}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))
            }
            placeholder="Cover image URL"
          />

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-md border px-2 text-sm"
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
              >
                <option value="">Add lesson…</option>
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" onClick={addLessonToForm}>
                Add
              </Button>
            </div>

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
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              lessons: prev.lessons.map((item, idx) =>
                                idx === index
                                  ? { ...item, isRequired: e.target.checked }
                                  : item,
                              ),
                            }))
                          }
                        />
                        Required
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => reorderLessons(index, index - 1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === form.lessons.length - 1}
                        onClick={() => reorderLessons(index, index + 1)}
                      >
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

          <div className="flex gap-2">
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update Template" : "Create Template"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
