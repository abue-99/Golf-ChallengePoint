/**
 * Training load of a player across all coaches: pure helpers (unit-tested
 * without a database).
 */
import { dayKey, shiftDayKey } from './roster.helpers';

/** Default weekly limit when no coach set one (minutes). */
export const DEFAULT_WEEKLY_LIMIT = 600;
/** "High" from this share of the limit on. */
export const HIGH_SHARE = 0.85;
/** Long team events (trips, matches) count at most this much per event. */
export const EVENT_CAP_MINUTES = 240;

export type LoadKind = 'training' | 'event' | 'session' | 'lesson';

export type LoadItem = {
  start: Date;
  minutes: number;
  kind: LoadKind;
  /** Who planned it; null when unknown. */
  coachId: string | null;
};

export type LoadWeek = {
  start: string;
  end: string;
  minutes: number;
  byKind: Record<LoadKind, number>;
  byCoach: { coachId: string | null; name: string; minutes: number }[];
  tournamentDays: number;
  level: 'ok' | 'high' | 'over';
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Offset of `timeZone` from UTC at `date`, in ms. */
function zoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
}

/** 00:00 of a YYYY-MM-DD day in `timeZone`. */
export function zonedDayStart(key: string, timeZone: string) {
  const [year, month, day] = key.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - zoneOffset(new Date(guess), timeZone);
  // Second pass for days where the offset changes (DST).
  result = guess - zoneOffset(new Date(result), timeZone);
  return new Date(result);
}

/** Monday 00:00 of this week and the following `count` week starts. */
export function weekStarts(now: Date, timeZone: string, count = 2) {
  const today = dayKey(now, timeZone);
  const [year, month, day] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const monday = shiftDayKey(today, -((weekday + 6) % 7));
  return Array.from({ length: count + 1 }, (_, index) =>
    zonedDayStart(shiftDayKey(monday, index * 7), timeZone),
  );
}

/** Calendar days of [start, end] that fall into [from, to). */
export function daysWithin(
  start: Date,
  end: Date,
  from: Date,
  to: Date,
  timeZone: string,
) {
  const s = start < from ? from : start;
  const e = end > to ? new Date(to.getTime() - 1) : end;
  if (e < s) return 0;
  const first = dayKey(s, timeZone);
  const last = dayKey(e, timeZone);
  let count = 0;
  for (let key = first; key <= last; key = shiftDayKey(key, 1)) {
    count += 1;
    if (count > 14) break;
  }
  return count;
}

export function loadLevel(minutes: number, limit: number): LoadWeek['level'] {
  if (minutes > limit) return 'over';
  if (minutes >= limit * HIGH_SHARE) return 'high';
  return 'ok';
}

/** Sums the items of one player per week and per coach. */
export function summarizeWeeks(input: {
  items: LoadItem[];
  tournaments: { start: Date; end: Date }[];
  starts: Date[];
  limit: number;
  coachName: (coachId: string | null) => string;
  timeZone: string;
}): LoadWeek[] {
  const weeks: LoadWeek[] = [];
  for (let index = 0; index < input.starts.length - 1; index += 1) {
    const from = input.starts[index];
    const to = input.starts[index + 1];
    const inWeek = input.items.filter(
      (item) => item.start >= from && item.start < to && item.minutes > 0,
    );
    const byKind: Record<LoadKind, number> = {
      training: 0,
      event: 0,
      session: 0,
      lesson: 0,
    };
    const byCoach = new Map<string | null, number>();
    let minutes = 0;
    for (const item of inWeek) {
      minutes += item.minutes;
      byKind[item.kind] += item.minutes;
      byCoach.set(
        item.coachId,
        (byCoach.get(item.coachId) ?? 0) + item.minutes,
      );
    }
    const tournamentDays = Math.min(
      7,
      input.tournaments.reduce(
        (sum, tournament) =>
          sum +
          daysWithin(
            tournament.start,
            tournament.end,
            from,
            to,
            input.timeZone,
          ),
        0,
      ),
    );
    weeks.push({
      start: from.toISOString(),
      end: to.toISOString(),
      minutes,
      byKind,
      byCoach: [...byCoach.entries()]
        .map(([coachId, value]) => ({
          coachId,
          name: input.coachName(coachId),
          minutes: value,
        }))
        .sort((a, b) => b.minutes - a.minutes),
      tournamentDays,
      level: loadLevel(minutes, input.limit),
    });
  }
  return weeks;
}

/** Open lessons that two or more coaches gave the same player. */
export function findDuplicates(
  assignments: {
    lessonId: string;
    lessonName: string;
    coachId: string;
  }[],
  coachName: (coachId: string | null) => string,
) {
  const byLesson = new Map<string, { name: string; coaches: Set<string> }>();
  for (const assignment of assignments) {
    const entry = byLesson.get(assignment.lessonId) ?? {
      name: assignment.lessonName,
      coaches: new Set<string>(),
    };
    entry.coaches.add(assignment.coachId);
    byLesson.set(assignment.lessonId, entry);
  }
  return [...byLesson.entries()]
    .filter(([, entry]) => entry.coaches.size >= 2)
    .map(([lessonId, entry]) => ({
      lessonId,
      lessonName: entry.name,
      coachIds: [...entry.coaches],
      coaches: [...entry.coaches].map((id) => coachName(id)),
    }));
}

export const WEEK_MS = 7 * DAY_MS;
