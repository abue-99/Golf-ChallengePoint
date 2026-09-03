"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Route as JourneyIcon, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { JourneyTemplate } from "@/types/journey-template";

function difficultyLabel(value: JourneyTemplate["difficulty"]) {
  if (value === "BEGINNER") return "Beginner";
  if (value === "INTERMEDIATE") return "Intermediate";
  if (value === "ADVANCED") return "Advanced";
  return "—";
}

function DraggableJourneyTemplateCard({
  journey,
  onJourneyClick,
}: {
  journey: JourneyTemplate;
  onJourneyClick?: (journey: JourneyTemplate) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `journey:${journey.id}`,
      data: { journeyTemplate: journey },
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "rounded-md border bg-card px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing select-none transition-transform transition-shadow",
        isDragging && "z-50 scale-[1.02] shadow-xl ring-2 ring-primary opacity-75",
      )}
      onClick={() => onJourneyClick?.(journey)}
      title={`Drag or tap to assign \"${journey.name}\"`}
    >
      <div {...attributes} {...listeners} className="min-w-0 space-y-0.5">
        <p className="truncate font-medium">{journey.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {journey.category ?? "Uncategorized"} · {difficultyLabel(journey.difficulty)}
        </p>
        <p className="text-[11px] text-emerald-700">
          {journey.lessons.length} lesson{journey.lessons.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

export default function JourneyTemplateLibrarySidebar({
  onJourneyClick,
}: {
  onJourneyClick?: (journey: JourneyTemplate) => void;
}) {
  const [journeys, setJourneys] = useState<JourneyTemplate[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.listJourneyTemplates().then((data: JourneyTemplate[] | unknown) => {
      setJourneys(Array.isArray(data) ? data : []);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!journeys) return [];
    const lower = q.toLowerCase();
    return journeys.filter(
      (journey) =>
        !q ||
        journey.name.toLowerCase().includes(lower) ||
        (journey.category ?? "").toLowerCase().includes(lower) ||
        (journey.description ?? "").toLowerCase().includes(lower),
    );
  }, [journeys, q]);

  return (
    <section className="flex min-h-0 flex-col border-t">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <JourneyIcon className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">Journeys</span>
      </div>

      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search journeys…"
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-b">
        Drag a journey onto a player or team.
      </p>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {journeys === null ? (
          <p className="text-xs text-muted-foreground px-1">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No journeys found.</p>
        ) : (
          filtered.map((journey) => (
            <DraggableJourneyTemplateCard
              key={journey.id}
              journey={journey}
              onJourneyClick={onJourneyClick}
            />
          ))
        )}
      </div>

      <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Star className="h-3 w-3" />
        Short tap still opens quick assign.
      </div>
    </section>
  );
}
