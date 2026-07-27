"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoUploadField } from "@/components/VideoUploadField";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  LESSON_STATUSES,
  PRIORITIES,
  GOAL_ACHIEVED_OPTIONS,
  type TrainingLesson,
  type LessonPlayer,
} from "@/lib/lesson-types";
import { toast } from "sonner";

type FormData = {
  // General
  name: string;
  durationMinutes: string;
  focusArea: string;
  location: string;
  status: string;
  videoUrl: string | null;
  playerId: string;
  // Goals
  trainingObjective: string;
  currentSituation: string;
  targetOutcome: string;
  priority: string;
  plannedExercises: string;
  successCriteria: string;
  // Results
  goalAchieved: string;
  playerSelfAssessment: string;
  coachRating: string;
  afterSessionVideoUrl: string | null;
  performanceScore: string;
  comments: string;
  keyLearnings: string;
};

const EMPTY: FormData = {
  name: "",
  durationMinutes: "",
  focusArea: "",
  location: "",
  status: "PLANNED",
  videoUrl: null,
  playerId: "",
  trainingObjective: "",
  currentSituation: "",
  targetOutcome: "",
  priority: "",
  plannedExercises: "",
  successCriteria: "",
  goalAchieved: "",
  playerSelfAssessment: "",
  coachRating: "",
  afterSessionVideoUrl: null,
  performanceScore: "",
  comments: "",
  keyLearnings: "",
};

function lessonToForm(lesson: TrainingLesson): FormData {
  return {
    name: lesson.name,
    durationMinutes: String(lesson.durationMinutes),
    focusArea: lesson.focusArea,
    location: lesson.location ?? "",
    status: lesson.status,
    videoUrl: lesson.videoUrl ?? null,
    playerId: lesson.playerId ?? "",
    trainingObjective: lesson.trainingObjective ?? "",
    currentSituation: lesson.currentSituation ?? "",
    targetOutcome: lesson.targetOutcome ?? "",
    priority: lesson.priority ?? "",
    plannedExercises: lesson.plannedExercises ?? "",
    successCriteria: lesson.successCriteria ?? "",
    goalAchieved: lesson.goalAchieved ?? "",
    playerSelfAssessment:
      lesson.playerSelfAssessment != null
        ? String(lesson.playerSelfAssessment)
        : "",
    coachRating: lesson.coachRating != null ? String(lesson.coachRating) : "",
    afterSessionVideoUrl: lesson.afterSessionVideoUrl ?? null,
    performanceScore:
      lesson.performanceScore != null ? String(lesson.performanceScore) : "",
    comments: lesson.comments ?? "",
    keyLearnings: lesson.keyLearnings ?? "",
  };
}

function buildPayload(f: FormData) {
  return {
    name: f.name.trim(),
    durationMinutes: parseInt(f.durationMinutes, 10),
    focusArea: f.focusArea,
    location: f.location.trim() || undefined,
    status: f.status,
    videoUrl: f.videoUrl || undefined,
    playerId: f.playerId || undefined,
    trainingObjective: f.trainingObjective.trim() || undefined,
    currentSituation: f.currentSituation.trim() || undefined,
    targetOutcome: f.targetOutcome.trim() || undefined,
    priority: f.priority || undefined,
    plannedExercises: f.plannedExercises.trim() || undefined,
    successCriteria: f.successCriteria.trim() || undefined,
    goalAchieved: f.goalAchieved || undefined,
    playerSelfAssessment: f.playerSelfAssessment
      ? parseInt(f.playerSelfAssessment, 10)
      : undefined,
    coachRating: f.coachRating ? parseInt(f.coachRating, 10) : undefined,
    afterSessionVideoUrl: f.afterSessionVideoUrl || undefined,
    performanceScore: f.performanceScore
      ? parseInt(f.performanceScore, 10)
      : undefined,
    comments: f.comments.trim() || undefined,
    keyLearnings: f.keyLearnings.trim() || undefined,
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
  const [players, setPlayers] = useState<LessonPlayer[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    api.listLessonPlayers().then((data) => {
      if (Array.isArray(data)) setPlayers(data);
    });
  }, []);

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
    if (!form.status) errs.status = "Status is required";

    // Player self-assessment is required when completing
    if (
      form.status === "COMPLETED" &&
      form.playerSelfAssessment === ""
    ) {
      errs.playerSelfAssessment =
        "Player self-assessment is required when completing a lesson";
    }

    if (form.playerSelfAssessment) {
      const v = parseInt(form.playerSelfAssessment, 10);
      if (isNaN(v) || v < 1 || v > 10)
        errs.playerSelfAssessment = "Must be between 1 and 10";
    }
    if (form.coachRating) {
      const v = parseInt(form.coachRating, 10);
      if (isNaN(v) || v < 1 || v > 10)
        errs.coachRating = "Must be between 1 and 10";
    }
    if (form.performanceScore) {
      const v = parseInt(form.performanceScore, 10);
      if (isNaN(v) || v < 0 || v > 100)
        errs.performanceScore = "Must be between 0 and 100";
    }

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
        router.push(`/coach/lessons/${lesson.id}`);
      } else {
        const created = await api.createLesson(payload);
        toast.success("Lesson created");
        router.push(`/coach/lessons/${created.id}`);
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
            <input
              className={inputClass(false)}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="e.g. Driving range bay 3"
            />
          </div>

          {/* Status */}
          <div>
            <FieldLabel required>Status</FieldLabel>
            <select
              className={selectClass(!!errors.status)}
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {LESSON_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {errors.status && <FieldError>{errors.status}</FieldError>}
          </div>

          {/* Assign Player */}
          <div>
            <FieldLabel>Assign to Player (optional)</FieldLabel>
            <select
              className={selectClass(false)}
              value={form.playerId}
              onChange={(e) => set("playerId", e.target.value)}
            >
              <option value="">Unassigned</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName || p.lastName
                    ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()
                    : p.email}
                </option>
              ))}
            </select>
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

      {/* ── Results & Performance Tracking ──────────────────────────── */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-base font-semibold text-slate-800">
            Results &amp; Performance Tracking
          </CardTitle>
          <p className="text-xs text-slate-500">
            Fill in after the session is complete.
          </p>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
          <div>
            <FieldLabel>Goal Achieved</FieldLabel>
            <select
              className={selectClass(false)}
              value={form.goalAchieved}
              onChange={(e) => set("goalAchieved", e.target.value)}
            >
              <option value="">Select…</option>
              {GOAL_ACHIEVED_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Player self-assessment (required on COMPLETED) */}
          <div>
            <FieldLabel required={form.status === "COMPLETED"}>
              Player Self-Assessment (1–10)
              {form.status === "COMPLETED" && (
                <span className="ml-1 text-xs text-slate-400">
                  required on completion
                </span>
              )}
            </FieldLabel>
            <input
              type="number"
              min={1}
              max={10}
              className={inputClass(!!errors.playerSelfAssessment)}
              value={form.playerSelfAssessment}
              onChange={(e) => set("playerSelfAssessment", e.target.value)}
              placeholder="1–10"
            />
            {errors.playerSelfAssessment && (
              <FieldError>{errors.playerSelfAssessment}</FieldError>
            )}
          </div>

          <div>
            <FieldLabel>Coach Rating (1–10)</FieldLabel>
            <input
              type="number"
              min={1}
              max={10}
              className={inputClass(!!errors.coachRating)}
              value={form.coachRating}
              onChange={(e) => set("coachRating", e.target.value)}
              placeholder="1–10"
            />
            {errors.coachRating && (
              <FieldError>{errors.coachRating}</FieldError>
            )}
          </div>

          <div>
            <FieldLabel>Performance Score (0–100)</FieldLabel>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass(!!errors.performanceScore)}
              value={form.performanceScore}
              onChange={(e) => set("performanceScore", e.target.value)}
              placeholder="0–100"
            />
            {errors.performanceScore && (
              <FieldError>{errors.performanceScore}</FieldError>
            )}
          </div>

          {/* After-session video */}
          <div className="sm:col-span-2">
            <VideoUploadField
              label="After-Session Video"
              value={form.afterSessionVideoUrl}
              onChange={(url) => set("afterSessionVideoUrl", url)}
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Comments</FieldLabel>
            <textarea
              rows={3}
              className={textareaClass(false)}
              value={form.comments}
              onChange={(e) => set("comments", e.target.value)}
              placeholder="General comments about the session"
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Key Learnings</FieldLabel>
            <textarea
              rows={3}
              className={textareaClass(false)}
              value={form.keyLearnings}
              onChange={(e) => set("keyLearnings", e.target.value)}
              placeholder="What were the key takeaways?"
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
