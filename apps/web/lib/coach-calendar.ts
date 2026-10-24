/** Client calls for the coach calendar (team events and reminders). */

export class ApiError extends Error {
  status: number;
  conflicts: string[];
  constructor(message: string, status: number, conflicts: string[] = []) {
    super(message);
    this.status = status;
    this.conflicts = conflicts;
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : `Request failed (${res.status})`;
    const conflicts = Array.isArray(data?.conflicts)
      ? (data.conflicts as unknown[]).filter(
          (c): c is string => typeof c === "string",
        )
      : [];
    throw new ApiError(message, res.status, conflicts);
  }
  return data as T;
}

export type TeamEventInput = {
  teamId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  force?: boolean;
};

export type TeamEventRecord = {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  answersReset?: number;
};

export function createTeamEvent(input: TeamEventInput) {
  return call<TeamEventRecord>("/api/calendar/team-events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTeamEvent(id: string, input: Partial<TeamEventInput>) {
  // The team of an event cannot change.
  const { teamId: _teamId, ...rest } = input;
  void _teamId;
  return call<TeamEventRecord>(
    `/api/calendar/team-events/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(rest),
    },
  );
}

export function deleteTeamEvent(id: string) {
  return call<{ ok: boolean }>(
    `/api/calendar/team-events/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export type ReminderResult = {
  occurrenceKey: string;
  open: number;
  sent: number;
  failed: number;
  /** null when no e-mail could be delivered (nothing recorded). */
  lastReminder: { sentAt: string; kind: string } | null;
};

export function remindOpenPlayers(occurrenceKey: string) {
  return call<ReminderResult>("/api/calendar/coach/remind", {
    method: "POST",
    body: JSON.stringify({ occurrenceKey }),
  });
}

export function setAutoRemind(teamId: string, hours: number | null) {
  return call<{ id: string; autoRemindHours: number | null }>(
    `/api/calendar/coach/teams/${encodeURIComponent(teamId)}/auto-remind`,
    { method: "PUT", body: JSON.stringify({ hours }) },
  );
}

/** "2 h ago", "yesterday" … for reminder hints. */
export function timeAgo(value: string, now: number) {
  const minutes = Math.max(
    0,
    Math.round((now - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// ── Planning in the calendar (drag & drop) ───────────────────────────────

export type CreatedSlot = { id: string };
export type CreatedTask = {
  id: string;
  scheduledDate: string;
  durationMinutes: number;
};

/** One-time team training (the container for a lesson on a free time). */
export function createOneTimeTraining(input: {
  teamId: string;
  title: string;
  startTime: string;
  endTime: string;
  force?: boolean;
}) {
  const { teamId, ...body } = input;
  return call<CreatedSlot>(
    `/api/calendar/team-slots/${encodeURIComponent(teamId)}`,
    {
      method: "POST",
      body: JSON.stringify({ ...body, recurrence: "NONE" }),
    },
  );
}

/** Puts a lesson into a training window (a calendar task). */
export async function planLessonInTraining(input: {
  slotId: string;
  lesson: { id: string; name: string; description?: string | null };
  start: Date;
  durationMinutes: number;
}) {
  const created = await call<CreatedTask[] | CreatedTask>(
    `/api/calendar/slots/${encodeURIComponent(input.slotId)}/tasks`,
    {
      method: "POST",
      body: JSON.stringify({
        title: input.lesson.name,
        description: input.lesson.description ?? "",
        durationMinutes: input.durationMinutes,
        scheduledDate: input.start.toISOString(),
        lessonId: input.lesson.id,
      }),
    },
  );
  return Array.isArray(created) ? created : [created];
}

export function deleteCalendarTask(id: string) {
  return call<{ ok: boolean }>(
    `/api/calendar/tasks/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export function deleteTraining(id: string) {
  return call<{ ok: boolean }>(
    `/api/calendar/slots/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export function moveCalendarTask(
  id: string,
  start: Date,
  durationMinutes: number,
) {
  return call<CreatedTask>(`/api/calendar/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      scheduledDate: start.toISOString(),
      durationMinutes,
    }),
  });
}

export function moveTraining(
  id: string,
  start: Date,
  end: Date,
  force = false,
) {
  return call<{ id: string; answersReset?: number }>(
    `/api/calendar/slots/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        force,
      }),
    },
  );
}

/**
 * Where a lesson goes inside a training occurrence: at the wanted time if it
 * fits, otherwise moved (and if needed shortened) to stay inside.
 */
export function placeInOccurrence(
  occurrence: { start: Date; end: Date },
  wanted: Date | null,
  durationMinutes: number,
) {
  const windowMinutes = Math.round(
    (occurrence.end.getTime() - occurrence.start.getTime()) / 60_000,
  );
  const duration = Math.max(5, Math.min(durationMinutes || 30, windowMinutes));
  let start =
    wanted && wanted >= occurrence.start && wanted < occurrence.end
      ? wanted
      : occurrence.start;
  const latestStart = new Date(occurrence.end.getTime() - duration * 60_000);
  if (start > latestStart) start = latestStart;
  return {
    start,
    durationMinutes: duration,
    shortened: duration < (durationMinutes || 30),
  };
}
