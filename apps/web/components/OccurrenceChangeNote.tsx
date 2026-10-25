"use client";

import { formatDateInTimeZone } from "@/lib/timezone";
import type { CalendarActivity } from "@/types/calendar";

type ChangedActivity = Pick<
  CalendarActivity,
  "occurrenceStatus" | "originalStart" | "originalEnd" | "changeReason" | "type"
>;

function formatWhen(start: string, end: string | undefined, timeZone: string) {
  const day = formatDateInTimeZone(start, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = (value: string) =>
    formatDateInTimeZone(value, timeZone, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return end ? `${day}, ${time(start)}–${time(end)}` : `${day}, ${time(start)}`;
}

/** Small "Cancelled" / "Moved" chip for lists. */
export function OccurrenceChangeBadge({
  activity,
}: {
  activity: ChangedActivity;
}) {
  if (!activity.occurrenceStatus) return null;
  return activity.occurrenceStatus === "cancelled" ? (
    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
      Cancelled
    </span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
      New time
    </span>
  );
}

/** Banner: the coach cancelled or moved this date, with the coach's note. */
export function OccurrenceChangeNote({
  activity,
  timeZone,
  className = "",
}: {
  activity: ChangedActivity;
  timeZone: string;
  className?: string;
}) {
  if (!activity.occurrenceStatus) return null;
  const cancelled = activity.occurrenceStatus === "cancelled";
  // Lessons inside a cancelled training only carry the status.
  const isLesson = activity.type === "coach-assignment";
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${
        cancelled
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      } ${className}`}
    >
      <p className="font-semibold">
        {cancelled
          ? isLesson
            ? "The training for this lesson is cancelled"
            : "Your coach cancelled this date"
          : activity.originalStart
            ? `New time – was ${formatWhen(activity.originalStart, activity.originalEnd, timeZone)}`
            : "New time"}
      </p>
      {activity.changeReason ? (
        <p className="mt-0.5 whitespace-pre-wrap">{activity.changeReason}</p>
      ) : null}
    </div>
  );
}
