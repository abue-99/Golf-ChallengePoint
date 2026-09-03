"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  FOCUS_AREAS,
  LESSON_VISIBILITIES,
  getFocusAreaPath,
  getSubCapabilitiesForFocusArea,
  getSubSubCapabilitiesForFocusArea,
  getLocationLabel,
  type TrainingLesson,
} from "@/lib/lesson-types";
import { Plus, Search, BookOpen, Clock, MapPin, User, Globe, Lock, Upload } from "lucide-react";
import AssignLessonModal from "@/components/AssignLessonModal";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ImportableLessonPayload = {
  name: string;
  description?: string;
  durationMinutes: number;
  focusArea: string;
  subCapability?: string;
  subSubCapability?: string;
  location?: string;
  status?: string;
  visibility?: string;
  videoUrl?: string;
  playerId?: string;
  trainingObjective?: string;
  currentSituation?: string;
  targetOutcome?: string;
  priority?: string;
  plannedExercises?: string;
  successCriteria?: string;
  goalAchieved?: string;
  playerSelfAssessment?: number;
  coachRating?: number;
  afterSessionVideoUrl?: string;
  performanceScore?: number;
  comments?: string;
  keyLearnings?: string;
};

const IMPORT_FIELD_ALIASES: Record<string, keyof ImportableLessonPayload> = {
  name: "name",
  description: "description",
  durationminutes: "durationMinutes",
  duration: "durationMinutes",
  focusarea: "focusArea",
  subcapability: "subCapability",
  subsubcapability: "subSubCapability",
  location: "location",
  status: "status",
  visibility: "visibility",
  videourl: "videoUrl",
  playerid: "playerId",
  trainingobjective: "trainingObjective",
  currentsituation: "currentSituation",
  targetoutcome: "targetOutcome",
  priority: "priority",
  plannedexercises: "plannedExercises",
  successcriteria: "successCriteria",
  goalachieved: "goalAchieved",
  playerselfassessment: "playerSelfAssessment",
  coachrating: "coachRating",
  aftersessionvideourl: "afterSessionVideoUrl",
  performancescore: "performanceScore",
  comments: "comments",
  keylearnings: "keyLearnings",
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeEnumValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase().replace(/\s+/g, "_");
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toLessonPayload(rawRow: Record<string, unknown>): {
  payload?: ImportableLessonPayload;
  error?: string;
} {
  const mapped: Partial<ImportableLessonPayload> = {};

  for (const [key, value] of Object.entries(rawRow)) {
    const mappedKey = IMPORT_FIELD_ALIASES[normalizeHeader(key)];
    if (!mappedKey) continue;
    mapped[mappedKey] = value as never;
  }

  const name = toOptionalString(mapped.name);
  const durationMinutes = toOptionalNumber(mapped.durationMinutes);
  const focusArea = normalizeEnumValue(mapped.focusArea);
  if (!name) return { error: "Missing name" };
  if (!durationMinutes || durationMinutes <= 0) {
    return { error: `Invalid durationMinutes for "${name}"` };
  }
  if (!focusArea) return { error: `Missing focusArea for "${name}"` };

  const payload: ImportableLessonPayload = {
    name,
    durationMinutes,
    focusArea,
    description: toOptionalString(mapped.description),
    subCapability: toOptionalString(mapped.subCapability),
    subSubCapability: toOptionalString(mapped.subSubCapability),
    location: normalizeEnumValue(mapped.location),
    status: normalizeEnumValue(mapped.status),
    visibility: normalizeEnumValue(mapped.visibility),
    videoUrl: toOptionalString(mapped.videoUrl),
    playerId: toOptionalString(mapped.playerId),
    trainingObjective: toOptionalString(mapped.trainingObjective),
    currentSituation: toOptionalString(mapped.currentSituation),
    targetOutcome: toOptionalString(mapped.targetOutcome),
    priority: normalizeEnumValue(mapped.priority),
    plannedExercises: toOptionalString(mapped.plannedExercises),
    successCriteria: toOptionalString(mapped.successCriteria),
    goalAchieved: normalizeEnumValue(mapped.goalAchieved),
    playerSelfAssessment: toOptionalNumber(mapped.playerSelfAssessment),
    coachRating: toOptionalNumber(mapped.coachRating),
    afterSessionVideoUrl: toOptionalString(mapped.afterSessionVideoUrl),
    performanceScore: toOptionalNumber(mapped.performanceScore),
    comments: toOptionalString(mapped.comments),
    keyLearnings: toOptionalString(mapped.keyLearnings),
  };

  return { payload };
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<TrainingLesson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");
  const [focusFilter, setFocusFilter] = useState("");
  const [subCapabilityFilter, setSubCapabilityFilter] = useState("");
  const [subSubCapabilityFilter, setSubSubCapabilityFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [myId, setMyId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        toast.error("No worksheet found in selected file.");
        return;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
      });
      if (rows.length === 0) {
        toast.error("The selected file has no lesson rows.");
        return;
      }

      let created = 0;
      const errors: string[] = [];
      for (const [index, row] of rows.entries()) {
        const parsed = toLessonPayload(row);
        if (!parsed.payload) {
          errors.push(`Row ${index + 2}: ${parsed.error ?? "Invalid row"}`);
          continue;
        }
        try {
          await api.createLesson(parsed.payload);
          created += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Create failed";
          errors.push(`Row ${index + 2}: ${message}`);
        }
      }

      if (created > 0) {
        const refreshed = await api.listLessons();
        setLessons(Array.isArray(refreshed) ? refreshed : []);
        toast.success(`${created} lesson${created === 1 ? "" : "s"} imported.`);
      }
      if (errors.length > 0) {
        toast.error(
          `Import completed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`,
          { description: errors.slice(0, 3).join(" · ") },
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import file.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

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
        <div className="flex flex-wrap gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void handleImportFile(file);
            }}
          />
          <Button
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importing..." : "Import CSV/Excel"}
          </Button>
          <Link href="/coach/lessons/new">
            <Button className="bg-green-600 text-white hover:bg-green-500">
              <Plus className="mr-2 h-4 w-4" />
              New Lesson
            </Button>
          </Link>
        </div>
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
  const [assignOpen, setAssignOpen] = useState(false);
  const focusLabel =
    FOCUS_AREAS.find((f) => f.value === lesson.focusArea)?.label ??
    lesson.focusArea;
  const capabilityPath = getFocusAreaPath(
    lesson.focusArea,
    lesson.subCapability,
    lesson.subSubCapability
  );
  const showCapabilityPath = capabilityPath !== focusLabel;

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
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
              <BookOpen className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium leading-tight text-slate-800">
                {lesson.name}
              </p>
              <p className="text-xs text-slate-500">{focusLabel}</p>
              {showCapabilityPath && (
                <p className="text-[11px] text-slate-400">{capabilityPath}</p>
              )}
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
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => setAssignOpen(true)}
              title="Assign this lesson to a player or team"
            >
              <BookOpen className="h-3 w-3" />
              Assign
            </Button>
            {isOwner && (
              <Link href={`/coach/lessons/${lesson.id}?mode=edit`}>
                <Button
                  size="sm"
                  className="bg-green-600 text-white hover:bg-green-500"
                >
                  Edit
                </Button>
              </Link>
            )}
            {!isOwner && isPublic && (
              <Link href={`/coach/lessons/${lesson.id}`}>
                <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                  View
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>

      <AssignLessonModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        preselectedLesson={lesson}
        onAssigned={() => {
          toast.success(`"${lesson.name}" assigned.`);
          setAssignOpen(false);
        }}
      />
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
