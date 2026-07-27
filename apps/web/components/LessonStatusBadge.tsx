"use client";

import { cn } from "@/lib/utils";
import type { LessonStatus } from "@/lib/lesson-types";

const STATUS_MAP: Record<LessonStatus, { label: string; classes: string }> = {
  PLANNED: {
    label: "Planned",
    classes: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  IN_PROGRESS: {
    label: "In Progress",
    classes: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  COMPLETED: {
    label: "Completed",
    classes: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const { label, classes } = STATUS_MAP[status] ?? STATUS_MAP.PLANNED;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        classes
      )}
    >
      {label}
    </span>
  );
}
