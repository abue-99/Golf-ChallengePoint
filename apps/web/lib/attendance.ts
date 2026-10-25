import type { AttendanceStatus, CalendarActivity } from "@/types/calendar";

export type { AttendanceStatus };

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  GOING: "Going",
  MAYBE: "Maybe",
  NOT_GOING: "Can't make it",
};

/**
 * Team trainings and team events can be answered until they are over –
 * not when the coach cancelled that date.
 */
export function canAnswer(
  activity: Pick<
    CalendarActivity,
    "type" | "end" | "occurrenceKey" | "occurrenceStatus"
  >,
) {
  return (
    (activity.type === "team-practice" || activity.type === "team-event") &&
    Boolean(activity.occurrenceKey) &&
    activity.occurrenceStatus !== "cancelled" &&
    new Date(activity.end).getTime() > Date.now()
  );
}

export async function respondAttendance(
  activity: Pick<CalendarActivity, "type" | "sourceId" | "start">,
  status: AttendanceStatus,
  note?: string | null,
) {
  const body =
    activity.type === "team-event"
      ? { teamEventId: activity.sourceId, status, note: note ?? null }
      : {
          practiceSlotId: activity.sourceId,
          occurrenceStart: activity.start,
          status,
          note: note ?? null,
        };
  const res = await fetch("/api/calendar/attendance", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "Your answer could not be saved.",
    );
  }
  return data as {
    occurrenceKey: string;
    status: AttendanceStatus;
    note: string | null;
  };
}
