"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import type { TrainingLesson } from "@/lib/lesson-types";
import { trackCoachTelemetry } from "@/lib/telemetry";

type AssignmentTarget =
  | { kind: "player"; playerId: string; playerName: string }
  | { kind: "team"; teamId: string; teamName: string }
  | { kind: "queue" };

type AssignmentResult = {
  id?: string;
  teamId?: string;
  lessonId?: string;
  playersAffected?: number;
  assignmentsCreated?: number;
  assignments?: { id: string; playerId: string | null }[];
};

type DndLessonContextValue = {
  /** Lesson currently being dragged, if any */
  activeLesson: TrainingLesson | null;
  /** Call when a drag starts */
  onDragStart: (lesson: TrainingLesson) => void;
  /** Programmatically trigger an assignment (e.g., from button click) */
  assignLesson: (
    lesson: TrainingLesson,
    target: AssignmentTarget,
  ) => Promise<AssignmentResult | void>;
  /** Last error message, if any */
  lastError: string | null;
  clearError: () => void;
};

const DndLessonContext = createContext<DndLessonContextValue | null>(null);

export function useDndLesson() {
  const ctx = useContext(DndLessonContext);
  if (!ctx) throw new Error("useDndLesson must be used inside DndLessonProvider");
  return ctx;
}

type Props = {
  children: ReactNode;
  /** Called after a successful player/team assignment so the parent can refresh data */
  onAssigned?: (target: AssignmentTarget, result?: AssignmentResult | void) => void;
  /**
   * Called when a lesson is dropped on the "training-queue" target.
   * The parent should open the AssignLessonModal with the lesson pre-selected
   * and `defaultAddToQueue=true` so the user can choose a target player.
   * If not provided, queue drops are silently ignored.
   */
  onQueueDrop?: (lesson: TrainingLesson) => void;
};

export function DndLessonProvider({ children, onAssigned, onQueueDrop }: Props) {
  const [activeLesson, setActiveLesson] = useState<TrainingLesson | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Activate drag only after 5 px of movement so taps still work on touch
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 5 },
    }),
  );

  const assignLesson = useCallback(
    async (lesson: TrainingLesson, target: AssignmentTarget) => {
      // Queue drops require a player to be specified — delegate to parent via onQueueDrop
      if (target.kind === "queue") {
        onQueueDrop?.(lesson);
        return;
      }
      try {
        const payload: Record<string, unknown> = { lessonId: lesson.id };
        let result: AssignmentResult | void = undefined;
        if (target.kind === "player") {
          result = await api.assignLessonToPlayer(target.playerId, payload);
          trackCoachTelemetry("LessonAssignedToPlayer", {
            lessonId: lesson.id,
            playerId: target.playerId,
          });
        } else if (target.kind === "team") {
          result = await api.assignLessonToTeam(target.teamId, payload);
          trackCoachTelemetry("LessonAssignedToTeam", {
            lessonId: lesson.id,
            teamId: target.teamId,
          });
        }
        onAssigned?.(target, result);
        return result;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to assign lesson";
        setLastError(msg);
      }
    },
    [onAssigned, onQueueDrop],
  );

  const onDragStart = useCallback((lesson: TrainingLesson) => {
    setActiveLesson(lesson);
    trackCoachTelemetry("LessonDragStarted", { lessonId: lesson.id });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const lesson = activeLesson;
      setActiveLesson(null);

      if (!lesson || !event.over) {
        if (lesson) {
          trackCoachTelemetry("LessonAssignmentCancelled", { lessonId: lesson.id });
        }
        return;
      }

      const overId = String(event.over.id);
      if (overId.startsWith("player:")) {
        const [, playerId, ...rest] = overId.split(":");
        const playerName = rest.join(":") || playerId;
        await assignLesson(lesson, { kind: "player", playerId, playerName });
      } else if (overId.startsWith("team:")) {
        const [, teamId, ...rest] = overId.split(":");
        const teamName = rest.join(":") || teamId;
        await assignLesson(lesson, { kind: "team", teamId, teamName });
      } else if (overId === "training-queue") {
        await assignLesson(lesson, { kind: "queue" });
      }
    },
    [activeLesson, assignLesson],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { lesson?: TrainingLesson }
        | undefined;
      if (data?.lesson) onDragStart(data.lesson);
    },
    [onDragStart],
  );

  return (
    <DndLessonContext.Provider
      value={{
        activeLesson,
        onDragStart,
        assignLesson,
        lastError,
        clearError: () => setLastError(null),
      }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeLesson ? (
            <div className="w-56 truncate rounded-lg border border-primary bg-card px-3 py-2 text-sm font-medium shadow-2xl ring-1 ring-primary/20">
              {activeLesson.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DndLessonContext.Provider>
  );
}
