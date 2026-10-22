/**
 * Pure helpers for the coach roster: calendar-day keys in a time zone,
 * recurring training-window expansion and the per-day activity strip.
 */

export type DayState = 'done' | 'missed' | 'planned' | 'none';

export type RosterDay = {
  /** Calendar date in the viewer's time zone, YYYY-MM-DD. */
  date: string;
  state: DayState;
};

export type RecurringRange = {
  startTime: Date;
  endTime: Date;
  recurrence: string;
  recurrenceEndDate: Date | null;
};

export type Occurrence = { start: Date; end: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveTimeZone(
  value: string | null | undefined,
  fallback: string,
) {
  for (const candidate of [value, fallback, 'UTC']) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate });
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return 'UTC';
}

/** YYYY-MM-DD of `date` as seen in `timeZone`. */
export function dayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Shift a YYYY-MM-DD key by whole days (calendar arithmetic, DST-safe). */
export function shiftDayKey(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

/** Consecutive day keys from `today - past` to `today + future`. */
export function buildDayKeys(today: string, past: number, future: number) {
  const keys: string[] = [];
  for (let offset = -past; offset <= future; offset += 1) {
    keys.push(shiftDayKey(today, offset));
  }
  return keys;
}

function step(date: Date, recurrence: string, times: number) {
  switch (recurrence) {
    case 'DAILY':
      date.setDate(date.getDate() + times);
      break;
    case 'WEEKLY':
      date.setDate(date.getDate() + 7 * times);
      break;
    case 'MONTHLY':
      date.setMonth(date.getMonth() + times);
      break;
  }
}

/**
 * Occurrences of a (possibly recurring) window that overlap [from, to].
 * Jumps close to `from` first, so old recurring windows stay cheap.
 */
export function expandOccurrences(
  range: RecurringRange,
  from: Date,
  to: Date,
): Occurrence[] {
  const duration = range.endTime.getTime() - range.startTime.getTime();
  if (
    range.recurrence === 'NONE' ||
    !['DAILY', 'WEEKLY', 'MONTHLY'].includes(range.recurrence)
  ) {
    const occurrence = {
      start: new Date(range.startTime),
      end: new Date(range.endTime),
    };
    return occurrence.end >= from && occurrence.start <= to ? [occurrence] : [];
  }

  const upperBound =
    range.recurrenceEndDate && range.recurrenceEndDate < to
      ? range.recurrenceEndDate
      : to;
  const current = new Date(range.startTime);

  // Jump to just before `from` (one period of slack for DST / month lengths).
  if (current < from) {
    const gap = from.getTime() - current.getTime() - duration;
    let jumps = 0;
    if (range.recurrence === 'DAILY') jumps = Math.floor(gap / DAY_MS) - 1;
    if (range.recurrence === 'WEEKLY')
      jumps = Math.floor(gap / (7 * DAY_MS)) - 1;
    if (range.recurrence === 'MONTHLY') {
      jumps =
        (from.getFullYear() - current.getFullYear()) * 12 +
        (from.getMonth() - current.getMonth()) -
        2;
    }
    if (jumps > 0) step(current, range.recurrence, jumps);
  }

  const occurrences: Occurrence[] = [];
  let guard = 0;
  while (current <= upperBound && guard < 1000) {
    guard += 1;
    const end = new Date(current.getTime() + duration);
    if (end >= from) occurrences.push({ start: new Date(current), end });
    step(current, range.recurrence, 1);
  }
  return occurrences;
}

/** First occurrence that has not ended yet, looking up to `horizonDays` ahead. */
export function nextOccurrence(
  range: RecurringRange,
  now: Date,
  horizonDays = 120,
) {
  const to = new Date(now.getTime() + horizonDays * DAY_MS);
  return (
    expandOccurrences(range, now, to)
      .filter((occurrence) => occurrence.end >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null
  );
}

/**
 * Activity strip for one player.
 * - done:    something was completed that day
 * - missed:  a past day with planned calendar tasks and nothing completed
 * - planned: today or later with tasks or a training window
 * - none:    nothing scheduled, nothing done
 */
export function buildActivityDays(input: {
  dayKeys: string[];
  today: string;
  completedDays: Set<string>;
  taskDays: Set<string>;
  windowDays: Set<string>;
}): RosterDay[] {
  return input.dayKeys.map((date) => {
    if (input.completedDays.has(date)) return { date, state: 'done' };
    if (date < input.today) {
      return { date, state: input.taskDays.has(date) ? 'missed' : 'none' };
    }
    if (input.taskDays.has(date) || input.windowDays.has(date)) {
      return { date, state: 'planned' };
    }
    return { date, state: 'none' };
  });
}
