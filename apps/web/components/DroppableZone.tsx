"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  /**
   * Unique droppable id.
   * Conventions used by DndLessonProvider:
   *  - "player:<playerId>:<playerName>" → assigns to player
   *  - "team:<teamId>:<teamName>"       → assigns to team
   *  - "training-queue"                 → adds to queue
   */
  id: string;
  children: ReactNode;
  className?: string;
  /** Visual hint shown when a draggable is hovering over this zone */
  activeClassName?: string;
  disabled?: boolean;
};

/**
 * Wraps any element so a dragged lesson can be dropped onto it.
 * Works with both mouse and touch (pointer events via @dnd-kit).
 */
export default function DroppableZone({
  id,
  children,
  className,
  activeClassName,
  disabled,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && !disabled && (activeClassName ?? "ring-2 ring-primary ring-offset-1"))}
    >
      {children}
    </div>
  );
}
