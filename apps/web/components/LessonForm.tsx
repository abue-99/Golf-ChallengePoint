"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoUploadField } from "@/components/VideoUploadField";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  LOCATIONS,
  LESSON_VISIBILITIES,
  PRIORITIES,
  type TrainingLesson,
} from "@/lib/lesson-types";
import { toast } from "sonner";

type FormData = {
  // General
  name: string;
  description: string;
  durationMinutes: string;
  focusArea: string;
  location: string;
  visibility: string;
  videoUrl: string | null;
  // Goals
  trainingObjective: string;
  currentSituation: string;
  targetOutcome: string;
  priority: string;
  plannedExercises: string;
  successCriteria: string;
};

const EMPTY: FormData = {
  name: "",
  description: "",
  durationMinutes: "",
  focusArea: "",
  location: "",
  visibility: "PRIVATE",
  videoUrl: null,
  trainingObjective: "",
  currentSituation: "",
  targetOutcome: "",
  priority: "",
  plannedExercises: "",
  successCriteria: "",
};

function lessonToForm(lesson: TrainingLesson): FormData {
  return {
    name: lesson.name,
    description: lesson.description ?? "",
    durationMinutes: String(lesson.durationMinutes),
    focusArea: lesson.focusArea,
    location: lesson.location ?? "",
    visibility: lesson.visibility ?? "PRIVATE",
    videoUrl: lesson.videoUrl ?? null,
    trainingObjective: lesson.trainingObjective ?? "",
    currentSituation: lesson.currentSituation ?? "",
    targetOutcome: lesson.targetOutcome ?? "",
    priority: lesson.priority ?? "",
    plannedExercises: lesson.plannedExercises ?? "",
    successCriteria: lesson.successCriteria ?? "",
  };
}

function buildPayload(f: FormData) {
  return {
    name: f.name.trim(),
    description: f.description.trim() || undefined,
    durationMinutes: parseInt(f.durationMinutes, 10),
    focusArea: f.focusArea,
    location: f.location || undefined,
    visibility: f.visibility || "PRIVATE",
    videoUrl: f.videoUrl || undefined,
    trainingObjective: f.trainingObjective.trim() || undefined,
    currentSituation: f.currentSituation.trim() || undefined,
    targetOutcome: f.targetOutcome.trim() || undefined,
    priority: f.priority || undefined,
    plannedExercises: f.plannedExercises.trim() || undefined,
    successCriteria: f.successCriteria.trim() || undefined,
  };
}

interface LessonFormProps {
  lesson?: TrainingLesson;
  coachName?: string;
  createdAt?: string;
}

export default function LessonForm({
  lesson,
  coachName,
  createdAt,
}: LessonFormProps) {
  const router = useRouter();
  const isEdit = Boolean(lesson);
  const [form, setForm] = useState<FormData>(
    lesson ? lessonToForm(lesson) : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) errs.name = "Lesson name is required";
    if (!form.durationMinutes || isNaN(parseInt(form.durationMinutes, 10)))
      errs.durationMinutes = "Duration (minutes) is required";
    if (parseInt(form.durationMinutes, 10) <= 0)
      errs.durationMinutes = "Duration must be greater than 0";
    if (!form.focusArea) errs.focusArea = "Focus area is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (isEdit && lesson) {
        await api.updateLesson(lesson.id, payload);
        toast.success("Lesson updated");
        router.push("/coach/lessons");
      } else {
        await api.createLesson(payload);
        toast.success("Lesson created");
        router.push("/coach/lessons");
      }
      router.refresh();
    } catch {
      toast.error("Failed to save lesson. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── General Information ─────────────────────────────────────── */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-base font-semibold text-slate-800">
            General Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          {/* Lesson Name */}
          <div className="sm:col-span-2">
            <FieldLabel required>Lesson Name</FieldLabel>
            <input
              className={inputClass(!!errors.name)}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Putting fundamentals"
            />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              rows={3}
              className={textareaClass(false)}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief description of this lesson"
            />
          </div>

          {/* Duration */}
          <div>
            <FieldLabel required>Duration (minutes)</FieldLabel>
            <input
              type="number"
              min={1}
              className={inputClass(!!errors.durationMinutes)}
              value={form.durationMinutes}
              onChange={(e) => set("durationMinutes", e.target.value)}
              placeholder="e.g. 60"
            />
            {errors.durationMinutes && (
              <FieldError>{errors.durationMinutes}</FieldError>
            )}
          </div>

          {/* Focus Area */}
          <div>
            <FieldLabel required>Focus Area</FieldLabel>
            <select
              className={selectClass(!!errors.focusArea)}
              value={form.focusArea}
              onChange={(e) => set("focusArea", e.target.value)}
            >
              <option value="">Select focus area…</option>
              {FOCUS_AREAS.map((fa) => (
                <option key={fa.value} value={fa.value}>
                  {fa.label}
                </option>
              ))}
            </select>
            {errors.focusArea && <FieldError>{errors.focusArea}</FieldError>}
          </div>

          {/* Location */}
          <div>
            <FieldLabel>Location (optional)</FieldLabel>
            <select
              className={selectClass(false)}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            >
              <option value="">Select location…</option>
              {LOCATIONS.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <div>
            <FieldLabel required>Visibility</FieldLabel>
            <select
              className={selectClass(false)}
              value={form.visibility}
              onChange={(e) => set("visibility", e.target.value)}
            >
              {LESSON_VISIBILITIES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Public lessons are visible and assignable by all coaches.
            </p>
          </div>

          {/* Coach + created info (read-only) */}
          {isEdit && (
            <>
              {coachName && (
                <div>
                  <FieldLabel>Created by</FieldLabel>
                  <input
                    readOnly
                    className={inputClass(false) + " cursor-default bg-slate-50"}
                    value={coachName}
                  />
                </div>
              )}
              {createdAt && (
                <div>
                  <FieldLabel>Created at</FieldLabel>
                  <input
                    readOnly
                    className={inputClass(false) + " cursor-default bg-slate-50"}
                    value={new Date(createdAt).toLocaleString()}
                  />
                </div>
              )}
            </>
          )}

          {/* Pre-session video */}
          <div className="sm:col-span-2">
            <VideoUploadField
              label="Lesson Description Video (pre-session)"
              value={form.videoUrl}
              onChange={(url) => set("videoUrl", url)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Goal Setting ────────────────────────────────────────────── */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-base font-semibold text-slate-800">
            Goal Setting
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel>Training Objective</FieldLabel>
            <textarea
              rows={2}
              className={textareaClass(false)}
              value={form.trainingObjective}
              onChange={(e) => set("trainingObjective", e.target.value)}
              placeholder="What should the player achieve?"
            />
          </div>
          <div>
            <FieldLabel>Starting Point / Current Situation</FieldLabel>
            <textarea
              rows={2}
              className={textareaClass(false)}
              value={form.currentSituation}
              onChange={(e) => set("currentSituation", e.target.value)}
              placeholder="Current skill level or issue"
            />
          </div>
          <div>
            <FieldLabel>Target Outcome</FieldLabel>
            <textarea
              rows={2}
              className={textareaClass(false)}
              value={form.targetOutcome}
              onChange={(e) => set("targetOutcome", e.target.value)}
              placeholder="Desired result after the lesson"
            />
          </div>
          <div>
            <FieldLabel>Priority</FieldLabel>
            <select
              className={selectClass(false)}
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
            >
              <option value="">Select priority…</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Success Criteria</FieldLabel>
            <textarea
              rows={2}
              className={textareaClass(false)}
              value={form.successCriteria}
              onChange={(e) => set("successCriteria", e.target.value)}
              placeholder="How will success be measured?"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Planned Exercises</FieldLabel>
            <textarea
              rows={3}
              className={textareaClass(false)}
              value={form.plannedExercises}
              onChange={(e) => set("plannedExercises", e.target.value)}
              placeholder="List the exercises to be performed"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Lesson"}
        </Button>
      </div>
    </form>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

function inputClass(hasError: boolean) {
  return [
    "w-full rounded-lg border px-3 py-2 text-sm outline-none transition",
    "focus:ring-2 focus:ring-blue-200",
    hasError
      ? "border-red-400 focus:border-red-400"
      : "border-gray-200 focus:border-blue-400",
  ].join(" ");
}

function selectClass(hasError: boolean) {
  return [
    "w-full rounded-lg border px-3 py-2 text-sm outline-none transition bg-white",
    "focus:ring-2 focus:ring-blue-200",
    hasError
      ? "border-red-400 focus:border-red-400"
      : "border-gray-200 focus:border-blue-400",
  ].join(" ");
}

function textareaClass(hasError: boolean) {
  return [
    "w-full rounded-lg border px-3 py-2 text-sm outline-none transition resize-none",
    "focus:ring-2 focus:ring-blue-200",
    hasError
      ? "border-red-400 focus:border-red-400"
      : "border-gray-200 focus:border-blue-400",
  ].join(" ");
}

