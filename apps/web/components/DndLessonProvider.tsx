"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
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
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import type { TrainingLesson } from "@/lib/lesson-types";
import { trackCoachTelemetry } from "@/lib/telemetry";
import type { JourneyTemplate } from "@/types/journey-template";
import { toast } from "sonner";

type AssignmentTarget =
  | { kind: "player"; playerId: string; playerName: string }
  | { kind: "team"; teamId: string; teamName: string }
  | { kind: "queue" };

type AssignmentResult = {
  id?: string;
  teamId?: string;
  lessonId?: string;
  journeyTemplateId?: string;
  playersAffected?: number;
  assignmentsCreated?: number;
  assignments?: { id: string; playerId: string | null; playerPlanId?: string }[];
};

type DndSource =
  | { type: "lesson"; lesson: TrainingLesson }
  | { type: "journey"; journey: JourneyTemplate };

type DndLessonContextValue = {
  activeLesson: TrainingLesson | null;
  activeJourney: JourneyTemplate | null;
  onDragStart: (lesson: TrainingLesson) => void;
  onJourneyDragStart: (journey: JourneyTemplate) => void;
  assignLesson: (
    lesson: TrainingLesson,
    target: AssignmentTarget,
  ) => Promise<AssignmentResult | void>;
  assignJourney: (
    journey: JourneyTemplate,
    target: AssignmentTarget,
  ) => Promise<AssignmentResult | void>;
  lastError: string | null;
  clearError: () => void;
};

const DndLessonContext = createContext<DndLessonContextValue | null>(null);

export function useDndLesson() {
  const ctx = useContext(DndLessonContext);
  if (!ctx)
    throw new Error("useDndLesson must be used inside DndLessonProvider");
  return ctx;
}

type Props = {
  children: ReactNode;
  onAssigned?: (
    target: AssignmentTarget,
    result?: AssignmentResult | void,
    sourceType?: "lesson" | "journey",
  ) => void;
  onQueueDrop?: (lesson: TrainingLesson) => void;
};

function logDiagnostic(
  event:
    | "LessonDragStart"
    | "PlayerDropTargetEnter"
    | "PlayerDropTriggered"
    | "PlayerAssignmentRequest"
    | "PlayerAssignmentSuccess"
    | "PlayerAssignmentFailed",
  payload?: Record<string, unknown>,
) {
  trackCoachTelemetry(event, payload);
  if (typeof window !== "undefined") {
    console.info(`[AssignmentDiagnostic] ${event}`, payload ?? {});
  }
}

export function DndLessonProvider({
  children,
  onAssigned,
  onQueueDrop,
}: Props) {
  const [activeSource, setActiveSource] = useState<DndSource | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const lastHoverTargetRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 500, tolerance: 5 },
    }),
  );

  const assignItem = useCallback(
    async (source: DndSource, target: AssignmentTarget) => {
      if (target.kind === "queue") {
        if (source.type === "lesson") onQueueDrop?.(source.lesson);
        return;
      }

      const sourceId =
        source.type === "lesson" ? source.lesson.id : source.journey.id;

      if (target.kind === "player") {
        logDiagnostic("PlayerDropTriggered", {
          sourceType: source.type,
          sourceId,
          playerId: target.playerId,
        });
        logDiagnostic("PlayerAssignmentRequest", {
          sourceType: source.type,
          sourceId,
          playerId: target.playerId,
        });
      }

      try {
        let result: AssignmentResult | void = undefined;
        if (source.type === "lesson") {
          if (target.kind === "player") {
            result = await api.assignLessonToPlayer(target.playerId, {
              lessonId: source.lesson.id,
            });
            trackCoachTelemetry("LessonAssignedToPlayer", {
              lessonId: source.lesson.id,
              playerId: target.playerId,
            });
          } else {
            result = await api.assignLessonToTeam(target.teamId, {
              lessonId: source.lesson.id,
            });
            trackCoachTelemetry("LessonAssignedToTeam", {
              lessonId: source.lesson.id,
              teamId: target.teamId,
            });
          }
        } else {
          if (target.kind === "player") {
            result = await api.assignJourneyToPlayer(source.journey.id, target.playerId);
            trackCoachTelemetry("JourneyAssignedToPlayer", {
              journeyId: source.journey.id,
              playerId: target.playerId,
            });
          } else {
            result = await api.assignJourneyToTeam(source.journey.id, target.teamId);
            trackCoachTelemetry("JourneyAssignedToTeam", {
              journeyId: source.journey.id,
              teamId: target.teamId,
            });
          }
        }

        if (target.kind === "player") {
          logDiagnostic("PlayerAssignmentSuccess", {
            sourceType: source.type,
            sourceId,
            playerId: target.playerId,
          });
        }

        onAssigned?.(target, result, source.type);
        return result;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : `Failed to assign ${source.type}`;
        setLastError(msg);
        toast.error(msg);
        if (target.kind === "player") {
          logDiagnostic("PlayerAssignmentFailed", {
            sourceType: source.type,
            sourceId,
            playerId: target.playerId,
            error: msg,
          });
        }
      }
    },
    [onAssigned, onQueueDrop],
  );

  const assignLesson = useCallback(
    async (lesson: TrainingLesson, target: AssignmentTarget) =>
      assignItem({ type: "lesson", lesson }, target),
    [assignItem],
  );

  const assignJourney = useCallback(
    async (journey: JourneyTemplate, target: AssignmentTarget) =>
      assignItem({ type: "journey", journey }, target),
    [assignItem],
  );

  const onDragStart = useCallback((lesson: TrainingLesson) => {
    setActiveSource({ type: "lesson", lesson });
    trackCoachTelemetry("LessonDragStarted", { lessonId: lesson.id });
    logDiagnostic("LessonDragStart", { lessonId: lesson.id });
  }, []);

  const onJourneyDragStart = useCallback((journey: JourneyTemplate) => {
    setActiveSource({ type: "journey", journey });
    trackCoachTelemetry("JourneyDragStarted", { journeyId: journey.id });
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current as
        | { lesson?: TrainingLesson; journeyTemplate?: JourneyTemplate }
        | undefined;
      if (data?.lesson) {
        onDragStart(data.lesson);
      } else if (data?.journeyTemplate) {
        onJourneyDragStart(data.journeyTemplate);
      }
    },
    [onDragStart, onJourneyDragStart],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!activeSource || !event.over) return;
      const overId = String(event.over.id);
      if (overId.startsWith("player:") && lastHoverTargetRef.current !== overId) {
        const [, playerId, ...rest] = overId.split(":");
        const playerName = rest.join(":") || playerId;
        lastHoverTargetRef.current = overId;
        logDiagnostic("PlayerDropTargetEnter", {
          sourceType: activeSource.type,
          sourceId:
            activeSource.type === "lesson"
              ? activeSource.lesson.id
              : activeSource.journey.id,
          playerId,
          playerName,
        });
      }
    },
    [activeSource],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const source = activeSource;
      setActiveSource(null);
      lastHoverTargetRef.current = null;

      if (!source || !event.over) {
        trackCoachTelemetry("LessonAssignmentCancelled", {
          sourceType: source?.type,
        });
        return;
      }

      const overId = String(event.over.id);
      const overData = event.over.data.current as
        | { playerName?: string; teamName?: string }
        | undefined;
      if (overId.startsWith("player:")) {
        const [, playerId, ...rest] = overId.split(":");
        const playerName =
          overData?.playerName || rest.join(":") || playerId;
        await assignItem(source, { kind: "player", playerId, playerName });
      } else if (overId.startsWith("team:")) {
        const [, teamId, ...rest] = overId.split(":");
        const teamName = overData?.teamName || rest.join(":") || teamId;
        await assignItem(source, { kind: "team", teamId, teamName });
      } else if (overId === "training-queue") {
        await assignItem(source, { kind: "queue" });
      }
    },
    [activeSource, assignItem],
  );

  return (
    <DndLessonContext.Provider
      value={{
        activeLesson:
          activeSource?.type === "lesson" ? activeSource.lesson : null,
        activeJourney:
          activeSource?.type === "journey" ? activeSource.journey : null,
        onDragStart,
        onJourneyDragStart,
        assignLesson,
        assignJourney,
        lastError,
        clearError: () => setLastError(null),
      }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeSource ? (
            <div className="w-56 truncate rounded-lg border border-primary bg-card px-3 py-2 text-sm font-medium shadow-2xl ring-1 ring-primary/20">
              {activeSource.type === "lesson"
                ? activeSource.lesson.name
                : activeSource.journey.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DndLessonContext.Provider>
  );
}
