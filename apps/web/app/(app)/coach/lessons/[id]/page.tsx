"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LessonStatusBadge } from "@/components/LessonStatusBadge";
import LessonForm from "@/components/LessonForm";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  type TrainingLesson,
} from "@/lib/lesson-types";
import {
  ChevronLeft,
  Pencil,
  Trash2,
  BookOpen,
  Clock,
  MapPin,
  User,
  Target,
  BarChart2,
  Play,
  Globe,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<TrainingLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await api.getLesson(id);
        if (!ignore) setLesson(data?.id ? data : null);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this lesson?")) return;
    setDeleting(true);
    try {
      await api.deleteLesson(id);
      toast.success("Lesson deleted");
      router.push("/coach/lessons");
    } catch {
      toast.error("Failed to delete lesson");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-64 w-full animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="py-16 text-center text-slate-500">
        Lesson not found.{" "}
        <Link href="/coach/lessons" className="text-blue-600 hover:underline">
          Back to lessons
        </Link>
      </div>
    );
  }

  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === lesson.focusArea)?.label ??
    lesson.focusArea;

  const coachName = lesson.coach
    ? lesson.coach.firstName || lesson.coach.lastName
      ? `${lesson.coach.firstName ?? ""} ${lesson.coach.lastName ?? ""}`.trim()
      : lesson.coach.email
    : undefined;

  return (
    <div className="space-y-5">
      {/* Breadcrumb + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/coach/lessons"
            className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Lessons
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lesson.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {editing ? null : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
                className="text-slate-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
                className="text-slate-600 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <LessonForm
          lesson={lesson}
          coachName={coachName}
          createdAt={lesson.createdAt}
        />
      ) : (
        <ViewMode lesson={lesson} focusLabel={focusLabel} coachName={coachName} />
      )}
    </div>
  );
}

function ViewMode({
  lesson,
  focusLabel,
  coachName,
}: {
  lesson: TrainingLesson;
  focusLabel: string;
  coachName?: string;
}) {
  const playerName = lesson.player
    ? lesson.player.firstName || lesson.player.lastName
      ? `${lesson.player.firstName ?? ""} ${lesson.player.lastName ?? ""}`.trim()
      : lesson.player.email
    : null;

  return (
    <div className="space-y-5">
      {/* General */}
      <SectionCard title="General Information" icon={<BookOpen className="h-4 w-4" />}>
        <InfoGrid>
          <InfoItem label="Focus Area">{focusLabel}</InfoItem>
          <InfoItem label="Status">
            <LessonStatusBadge status={lesson.status} />
          </InfoItem>
          <InfoItem label="Visibility">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              lesson.visibility === "PUBLIC"
                ? "bg-green-50 text-green-700"
                : "bg-slate-100 text-slate-600"
            )}>
              {lesson.visibility === "PUBLIC" ? (
                <><Globe className="h-2.5 w-2.5" /> Public</>
              ) : (
                <><Lock className="h-2.5 w-2.5" /> Private</>
              )}
            </span>
          </InfoItem>
          <InfoItem label="Duration">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {lesson.durationMinutes} min
            </span>
          </InfoItem>
          {lesson.location && (
            <InfoItem label="Location">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {lesson.location}
              </span>
            </InfoItem>
          )}
          {playerName && (
            <InfoItem label="Assigned Player">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {playerName}
              </span>
            </InfoItem>
          )}
          {coachName && <InfoItem label="Created by">{coachName}</InfoItem>}
          <InfoItem label="Created at">
            {new Date(lesson.createdAt).toLocaleString()}
          </InfoItem>
        </InfoGrid>

        {lesson.videoUrl && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
              Pre-session Video
            </p>
            <VideoPreview url={lesson.videoUrl} />
          </div>
        )}
      </SectionCard>

      {/* Goals */}
      {(lesson.trainingObjective ||
        lesson.currentSituation ||
        lesson.targetOutcome ||
        lesson.priority ||
        lesson.plannedExercises ||
        lesson.successCriteria) && (
        <SectionCard title="Goal Setting" icon={<Target className="h-4 w-4" />}>
          <InfoGrid>
            {lesson.trainingObjective && (
              <InfoItem label="Training Objective" wide>
                {lesson.trainingObjective}
              </InfoItem>
            )}
            {lesson.currentSituation && (
              <InfoItem label="Current Situation">
                {lesson.currentSituation}
              </InfoItem>
            )}
            {lesson.targetOutcome && (
              <InfoItem label="Target Outcome">{lesson.targetOutcome}</InfoItem>
            )}
            {lesson.priority && (
              <InfoItem label="Priority">
                <PriorityBadge priority={lesson.priority} />
              </InfoItem>
            )}
            {lesson.successCriteria && (
              <InfoItem label="Success Criteria">
                {lesson.successCriteria}
              </InfoItem>
            )}
            {lesson.plannedExercises && (
              <InfoItem label="Planned Exercises" wide>
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {lesson.plannedExercises}
                </pre>
              </InfoItem>
            )}
          </InfoGrid>
        </SectionCard>
      )}

      {/* Results */}
      {(lesson.goalAchieved != null ||
        lesson.playerSelfAssessment != null ||
        lesson.coachRating != null ||
        lesson.performanceScore != null ||
        lesson.afterSessionVideoUrl ||
        lesson.comments ||
        lesson.keyLearnings) && (
        <SectionCard
          title="Results & Performance Tracking"
          icon={<BarChart2 className="h-4 w-4" />}
        >
          <InfoGrid>
            {lesson.goalAchieved && (
              <InfoItem label="Goal Achieved">{lesson.goalAchieved}</InfoItem>
            )}
            {lesson.playerSelfAssessment != null && (
              <InfoItem label="Player Self-Assessment">
                <ScoreBadge value={lesson.playerSelfAssessment} max={10} />
              </InfoItem>
            )}
            {lesson.coachRating != null && (
              <InfoItem label="Coach Rating">
                <ScoreBadge value={lesson.coachRating} max={10} />
              </InfoItem>
            )}
            {lesson.performanceScore != null && (
              <InfoItem label="Performance Score">
                <ScoreBadge value={lesson.performanceScore} max={100} />
              </InfoItem>
            )}
            {lesson.comments && (
              <InfoItem label="Comments" wide>
                {lesson.comments}
              </InfoItem>
            )}
            {lesson.keyLearnings && (
              <InfoItem label="Key Learnings" wide>
                {lesson.keyLearnings}
              </InfoItem>
            )}
          </InfoGrid>

          {lesson.afterSessionVideoUrl && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                After-Session Video
              </p>
              <VideoPreview url={lesson.afterSessionVideoUrl} />
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

// ── Small presentational helpers ───────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        {icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            {icon}
          </span>
        )}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <CardContent className="px-5 py-4">{children}</CardContent>
    </Card>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
  );
}

function InfoItem({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-600",
    MEDIUM: "bg-amber-50 text-amber-700",
    HIGH: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        map[priority] ?? map.LOW
      )}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

function ScoreBadge({ value, max }: { value: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
      {value}
      <span className="text-xs font-normal text-slate-400">/ {max}</span>
    </span>
  );
}

function VideoPreview({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
    >
      <Play className="h-4 w-4" />
      Open video
    </a>
  );
}
