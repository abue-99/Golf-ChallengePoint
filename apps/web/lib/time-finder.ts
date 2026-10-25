/**
 * Team time finder: turns the busy times of the team's players into a
 * heatmap of free times and suggests the best windows. Pure functions, all
 * times in the browser's time zone.
 */

export type BusyKind =
  | "absence"
  | "tournament"
  | "team-training"
  | "team-event";

export type BusyInterval = {
  start: string;
  end: string;
  kind: BusyKind;
  label: string;
  absenceType?: string;
};

export type FinderMember = {
  playerId: string;
  name: string;
  busy: BusyInterval[];
};

export type AvailabilityPayload = {
  team: { id: string; shortName: string };
  range: { from: string; to: string };
  members: FinderMember[];
};

/** Hours the grid shows (07:00–22:00) and its step. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 22;
export const STEP_MINUTES = 30;

const MINUTE_MS = 60_000;

export type Window = { start: Date; end: Date };

export type Blocker = { playerId: string; name: string; reasons: string[] };

export type WindowInfo = Window & {
  free: number;
  total: number;
  blockers: Blocker[];
  /** The coach has another session then. */
  coachBusy: boolean;
  past: boolean;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Monday 00:00 of the week containing `date` (local time). */
export function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** The seven local midnights from `weekStart` (DST-safe). */
export function weekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    day.setHours(0, 0, 0, 0);
    return day;
  });
}

/** Grid row starts of one day: 07:00, 07:30 … 21:30. */
export function slotStarts(day: Date) {
  const starts: Date[] = [];
  for (
    let minutes = DAY_START_HOUR * 60;
    minutes < DAY_END_HOUR * 60;
    minutes += STEP_MINUTES
  ) {
    const start = new Date(day);
    start.setHours(0, minutes, 0, 0);
    starts.push(start);
  }
  return starts;
}

/** Who cannot come in [start, end) and why. */
export function blockersFor(
  members: FinderMember[],
  start: Date,
  end: Date,
): Blocker[] {
  const from = start.getTime();
  const to = end.getTime();
  const result: Blocker[] = [];
  for (const member of members) {
    const reasons = member.busy
      .filter((busy) =>
        overlaps(
          new Date(busy.start).getTime(),
          new Date(busy.end).getTime(),
          from,
          to,
        ),
      )
      .map((busy) => busy.label);
    if (reasons.length > 0) {
      result.push({
        playerId: member.playerId,
        name: member.name,
        reasons: [...new Set(reasons)],
      });
    }
  }
  return result;
}

export function describeWindow(
  members: FinderMember[],
  window: Window,
  coachBusy: Window[],
  now: number,
): WindowInfo {
  const blockers = blockersFor(members, window.start, window.end);
  return {
    ...window,
    free: members.length - blockers.length,
    total: members.length,
    blockers,
    coachBusy: coachBusy.some((busy) =>
      overlaps(
        busy.start.getTime(),
        busy.end.getTime(),
        window.start.getTime(),
        window.end.getTime(),
      ),
    ),
    past: window.start.getTime() < now,
  };
}

/** One heatmap cell per day and grid row. */
export function buildGrid(
  members: FinderMember[],
  days: Date[],
  coachBusy: Window[],
  now: number,
) {
  return days.map((day) =>
    slotStarts(day).map((start) =>
      describeWindow(
        members,
        { start, end: new Date(start.getTime() + STEP_MINUTES * MINUTE_MS) },
        coachBusy,
        now,
      ),
    ),
  );
}

/**
 * Best windows of `durationMinutes`: most players free, the coach free, not
 * in the past, inside the visible hours. Picks do not overlap; at most two
 * per day so the suggestions spread over the week.
 */
export function suggestWindows(
  members: FinderMember[],
  days: Date[],
  durationMinutes: number,
  coachBusy: Window[],
  now: number,
  limit = 5,
) {
  if (members.length === 0) return [];
  const candidates: WindowInfo[] = [];
  for (const day of days) {
    const dayEnd = new Date(day);
    dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);
    for (const start of slotStarts(day)) {
      const end = new Date(start.getTime() + durationMinutes * MINUTE_MS);
      if (end > dayEnd) break;
      const info = describeWindow(members, { start, end }, coachBusy, now);
      if (info.past || info.coachBusy || info.free === 0) continue;
      candidates.push(info);
    }
  }
  candidates.sort(
    (a, b) => b.free - a.free || a.start.getTime() - b.start.getTime(),
  );
  const picked: WindowInfo[] = [];
  const perDay = new Map<string, number>();
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    const dayKey = candidate.start.toDateString();
    if ((perDay.get(dayKey) ?? 0) >= 2) continue;
    const clash = picked.some((pick) =>
      overlaps(
        pick.start.getTime(),
        pick.end.getTime(),
        candidate.start.getTime(),
        candidate.end.getTime(),
      ),
    );
    if (clash) continue;
    picked.push(candidate);
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1);
  }
  return picked.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Heat colour for the share of free players (0…1). */
export function heatClass(info: Pick<WindowInfo, "free" | "total" | "past">) {
  if (info.past) return "bg-slate-100";
  if (info.total === 0) return "bg-slate-50";
  const share = info.free / info.total;
  if (share === 1) return "bg-emerald-500";
  if (share >= 0.75) return "bg-emerald-300";
  if (share >= 0.5) return "bg-amber-200";
  if (share > 0) return "bg-orange-300";
  return "bg-rose-300";
}
