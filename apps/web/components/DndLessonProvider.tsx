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

type AssignmentTarget =
  | { kind: "player"; playerId: string; playerName: string }
  | { kind: "team"; teamId: string; teamName: string }
  | { kind: "queue" };

type DndLessonContextValue = {
  /** Lesson currently being dragged, if any */
  activeLesson: TrainingLesson | null;
  /** Call when a drag starts */
  onDragStart: (lesson: TrainingLesson) => void;
  /** Programmatically trigger an assignment (e.g., from button click) */
  assignLesson: (lesson: TrainingLesson, target: AssignmentTarget) => Promise<void>;
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
  /** Called after a successful assignment so the parent can refresh data */
  onAssigned?: (target: AssignmentTarget) => void;
};

export function DndLessonProvider({ children, onAssigned }: Props) {
  const [activeLesson, setActiveLesson] = useState<TrainingLesson | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Activate drag only after 5 px of movement so taps still work on touch
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const assignLesson = useCallback(
    async (lesson: TrainingLesson, target: AssignmentTarget) => {
      try {
        const payload: Record<string, unknown> = { lessonId: lesson.id };
        if (target.kind === "player") {
          payload.playerId = target.playerId;
          payload.targetType = "PLAYER";
        } else if (target.kind === "team") {
          payload.teamId = target.teamId;
          payload.targetType = "TEAM";
        } else if (target.kind === "queue") {
          payload.isInTrainingQueue = true;
        }
        await api.createStandaloneAssignment(payload);
        onAssigned?.(target);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to assign lesson";
        setLastError(msg);
      }
    },
    [onAssigned],
  );

  const onDragStart = useCallback((lesson: TrainingLesson) => {
    setActiveLesson(lesson);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const lesson = activeLesson;
      setActiveLesson(null);

      if (!lesson || !event.over) return;

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
            <div className="rounded-lg border border-primary bg-card px-3 py-2 shadow-lg opacity-90 text-sm font-medium w-48 truncate">
              {activeLesson.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DndLessonContext.Provider>
  );
}
