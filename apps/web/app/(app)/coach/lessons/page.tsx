"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  LESSON_VISIBILITIES,
  getSubCapabilitiesForFocusArea,
  getSubSubCapabilitiesForFocusArea,
  getLocationLabel,
  type TrainingLesson,
} from "@/lib/lesson-types";
import { Plus, Search, BookOpen, Clock, MapPin, User, Globe, Lock } from "lucide-react";

export default function LessonsPage() {
  const [lessons, setLessons] = useState<TrainingLesson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [focusFilter, setFocusFilter] = useState("");
  const [subCapabilityFilter, setSubCapabilityFilter] = useState("");
  const [subSubCapabilityFilter, setSubSubCapabilityFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (me?.id) setMyId(me.id); })
      .catch(() => {});
  }, []);

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
      const matchesFocus = !focusFilter || l.focusArea === focusFilter;
      const matchesSubCapability =
        !subCapabilityFilter || l.subCapability === subCapabilityFilter;
      const matchesSubSubCapability =
        !subSubCapabilityFilter || l.subSubCapability === subSubCapabilityFilter;
      const matchesVisibility = !visibilityFilter || l.visibility === visibilityFilter;
      return matchesQ && matchesFocus && matchesSubCapability && matchesSubSubCapability && matchesVisibility;
    });
  }, [lessons, q, focusFilter, subCapabilityFilter, subSubCapabilityFilter, visibilityFilter]);

  const subCapabilityOptions = useMemo(
    () => getSubCapabilitiesForFocusArea(focusFilter),
    [focusFilter]
  );

  const subSubCapabilityOptions = useMemo(
    () => getSubSubCapabilitiesForFocusArea(focusFilter, subCapabilityFilter),
    [focusFilter, subCapabilityFilter]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Lesson Library
          </h1>
          <p className="text-sm text-slate-500">
            Create reusable lessons. Public lessons are shared across all coaches.
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
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Visibility</option>
          {LESSON_VISIBILITIES.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={focusFilter}
          onChange={(e) => {
            setFocusFilter(e.target.value);
            setSubCapabilityFilter("");
            setSubSubCapabilityFilter("");
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Focus Areas</option>
          {FOCUS_AREAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={subCapabilityFilter}
          disabled={!focusFilter}
          onChange={(e) => {
            setSubCapabilityFilter(e.target.value);
            setSubSubCapabilityFilter("");
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
        >
          <option value="">
            {focusFilter ? "All Sub Capabilities" : "Select focus area first…"}
          </option>
          {subCapabilityOptions.map((sub) => (
            <option key={sub.value} value={sub.value}>
              {sub.label}
            </option>
          ))}
        </select>

        <select
          value={subSubCapabilityFilter}
          disabled={!subCapabilityFilter}
          onChange={(e) => setSubSubCapabilityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
        >
          <option value="">
            {subCapabilityFilter ? "All Sub Sub Capabilities" : "Select sub capability first…"}
          </option>
          {subSubCapabilityOptions.map((subSub) => (
            <option key={subSub.value} value={subSub.value}>
              {subSub.label}
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
            <LessonCard key={lesson.id} lesson={lesson} myId={myId} />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson, myId }: { lesson: TrainingLesson; myId: string | null }) {
  const router = useRouter();
  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === lesson.focusArea)?.label ??
    lesson.focusArea;

  const isOwner = myId && lesson.coachId === myId;
  const isPublic = lesson.visibility === "PUBLIC";

  const coachName = lesson.coach
    ? lesson.coach.firstName || lesson.coach.lastName
      ? `${lesson.coach.firstName ?? ""} ${lesson.coach.lastName ?? ""}`.trim()
      : lesson.coach.email
    : null;

  return (
    <Card
      className="group cursor-pointer border border-gray-200 bg-white shadow-[0_4px_16px_-4px_rgba(2,6,23,.1)] transition-shadow hover:shadow-[0_8px_24px_-6px_rgba(2,6,23,.15)]"
      onClick={() => router.push(`/coach/lessons/${lesson.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/coach/lessons/${lesson.id}`);
        }
      }}
      role="button"
      tabIndex={0}
    >
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
          <div className="flex flex-col items-end gap-1">
            <VisibilityBadge visibility={lesson.visibility} />
          </div>
        </div>

        {lesson.description && (
          <p className="mb-3 text-xs text-slate-600 line-clamp-3">
            {lesson.description}
          </p>
        )}

        <div className="mb-4 space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {lesson.durationMinutes} min
          </div>
          {lesson.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
          {getLocationLabel(lesson.location)}
            </div>
          )}
          {coachName && !isOwner && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span className="italic">By {coachName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {new Date(lesson.createdAt).toLocaleDateString()}
          </p>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {isOwner && (
              <Link href={`/coach/lessons/${lesson.id}?mode=edit`}>
                <Button
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-500"
                >
                  Edit
                </Button>
              </Link>
            )}
            {!isOwner && isPublic && (
              <Link href={`/coach/lessons/${lesson.id}`}>
                <Button size="sm" variant="outline">
                  View
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === "PUBLIC") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
        <Globe className="h-2.5 w-2.5" />
        Public
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
      <Lock className="h-2.5 w-2.5" />
      Private
    </span>
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
