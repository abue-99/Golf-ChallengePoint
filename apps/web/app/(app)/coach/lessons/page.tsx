"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LessonStatusBadge } from "@/components/LessonStatusBadge";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  LESSON_STATUSES,
  type TrainingLesson,
} from "@/lib/lesson-types";
import { Plus, Search, BookOpen, Clock, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LessonsPage() {
  const [lessons, setLessons] = useState<TrainingLesson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [focusFilter, setFocusFilter] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await api.listLessons();
        if (!ignore) setLessons(Array.isArray(data) ? data : []);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!lessons) return [];
    return lessons.filter((l) => {
      const matchesQ =
        !q || l.name.toLowerCase().includes(q.toLowerCase());
      const matchesStatus = !statusFilter || l.status === statusFilter;
      const matchesFocus = !focusFilter || l.focusArea === focusFilter;
      return matchesQ && matchesStatus && matchesFocus;
    });
  }, [lessons, q, statusFilter, focusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Training Lessons
          </h1>
          <p className="text-sm text-slate-500">
            Create and manage your training lessons.
          </p>
        </div>
        <Link href="/coach/lessons/new">
          <Button className="bg-blue-600 text-white hover:bg-blue-500">
            <Plus className="mr-2 h-4 w-4" />
            New Lesson
          </Button>
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lessons…"
            className="w-full rounded-lg border border-gray-200 bg-white px-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Statuses</option>
          {LESSON_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={focusFilter}
          onChange={(e) => setFocusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Focus Areas</option>
          {FOCUS_AREAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="p-10 text-center text-slate-500">
            {lessons?.length === 0
              ? "No lessons yet. Create your first lesson!"
              : "No lessons match your filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: TrainingLesson }) {
  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === lesson.focusArea)?.label ??
    lesson.focusArea;

  const playerName = lesson.player
    ? lesson.player.firstName || lesson.player.lastName
      ? `${lesson.player.firstName ?? ""} ${lesson.player.lastName ?? ""}`.trim()
      : lesson.player.email
    : null;

  return (
    <Card className="group border border-gray-200 bg-white shadow-[0_4px_16px_-4px_rgba(2,6,23,.1)] transition-shadow hover:shadow-[0_8px_24px_-6px_rgba(2,6,23,.15)]">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium leading-tight text-slate-800">
                {lesson.name}
              </p>
              <p className="text-xs text-slate-500">{focusLabel}</p>
            </div>
          </div>
          <LessonStatusBadge status={lesson.status} />
        </div>

        <div className="mb-4 space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {lesson.durationMinutes} min
          </div>
          {lesson.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {lesson.location}
            </div>
          )}
          {playerName && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {playerName}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {new Date(lesson.createdAt).toLocaleDateString()}
          </p>
          <Link href={`/coach/lessons/${lesson.id}`}>
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border border-gray-200 bg-white">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
            <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
