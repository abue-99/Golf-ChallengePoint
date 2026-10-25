/**
 * Single occurrences of a recurring team training can be moved or cancelled
 * (`practice_slot_exceptions`); the rest of the series stays unchanged.
 *
 * The helpers here turn the series plus its exceptions into the occurrences
 * that really take place. Pure functions apart from `loadSlotExceptions`, so
 * they are unit-tested without a database.
 *
 * Keys: an occurrence is answered and reminded under
 * `slot:<slotId>:<effective start>`. A moved occurrence therefore gets a new
 * key (new time = new question); a cancelled one keeps its series key.
 * Calendar UIDs and activity ids use the series start, so a subscribed
 * calendar updates the entry instead of adding a second one.
 */
import type { PrismaService } from '../prisma/prisma.service';
import {
  expandOccurrences,
  type Occurrence,
  type RecurringRange,
} from '../roster/roster.helpers';

export type SlotException = {
  originalStart: Date;
  cancelled: boolean;
  newStart: Date | null;
  newEnd: Date | null;
  reason: string | null;
};

export type OccurrenceStatus = 'scheduled' | 'moved' | 'cancelled';

export type EffectiveOccurrence = Occurrence & {
  /** Start/end of this occurrence in the series. */
  originalStart: Date;
  originalEnd: Date;
  status: OccurrenceStatus;
  reason: string | null;
};

const MINUTE_MS = 60_000;

function overlapsWindow(occurrence: Occurrence, from: Date, to: Date) {
  // Same rule as expandOccurrences.
  return occurrence.end >= from && occurrence.start <= to;
}

/** Whether `start` is the start of a real occurrence of the series. */
export function isSeriesOccurrence(range: RecurringRange, start: Date) {
  return expandOccurrences(
    range,
    new Date(start.getTime() - MINUTE_MS),
    new Date(start.getTime() + MINUTE_MS),
  ).some((occurrence) => occurrence.start.getTime() === start.getTime());
}

/**
 * Applies the exceptions to occurrences of the series. With a `window`,
 * moved occurrences whose series time lies outside but whose new time lies
 * inside are added, and occurrences moved out of the window are dropped.
 * Exceptions that no longer match the series (it was edited) are ignored.
 */
export function applyExceptions(
  range: RecurringRange,
  base: Occurrence[],
  exceptions: SlotException[] | undefined,
  window?: { from: Date; to: Date },
): EffectiveOccurrence[] {
  const byStart = new Map(
    (exceptions ?? []).map((exception) => [
      exception.originalStart.getTime(),
      exception,
    ]),
  );
  const used = new Set<number>();
  const result: EffectiveOccurrence[] = [];

  for (const occurrence of base) {
    const exception = byStart.get(occurrence.start.getTime());
    const series = {
      originalStart: new Date(occurrence.start),
      originalEnd: new Date(occurrence.end),
    };
    if (!exception) {
      result.push({
        ...series,
        start: new Date(occurrence.start),
        end: new Date(occurrence.end),
        status: 'scheduled',
        reason: null,
      });
      continue;
    }
    used.add(occurrence.start.getTime());
    if (exception.cancelled || !exception.newStart || !exception.newEnd) {
      result.push({
        ...series,
        start: new Date(occurrence.start),
        end: new Date(occurrence.end),
        status: 'cancelled',
        reason: exception.reason,
      });
    } else {
      result.push({
        ...series,
        start: new Date(exception.newStart),
        end: new Date(exception.newEnd),
        status: 'moved',
        reason: exception.reason,
      });
    }
  }

  if (window) {
    const duration = range.endTime.getTime() - range.startTime.getTime();
    for (const exception of exceptions ?? []) {
      if (used.has(exception.originalStart.getTime())) continue;
      if (exception.cancelled || !exception.newStart || !exception.newEnd) {
        continue;
      }
      const moved = { start: exception.newStart, end: exception.newEnd };
      if (!overlapsWindow(moved, window.from, window.to)) continue;
      if (!isSeriesOccurrence(range, exception.originalStart)) continue;
      result.push({
        originalStart: new Date(exception.originalStart),
        originalEnd: new Date(exception.originalStart.getTime() + duration),
        start: new Date(moved.start),
        end: new Date(moved.end),
        status: 'moved',
        reason: exception.reason,
      });
    }
  }

  return (
    window
      ? result.filter((occurrence) =>
          overlapsWindow(occurrence, window.from, window.to),
        )
      : result
  ).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Occurrences that really take place (or were cancelled) in [from, to]. */
export function expandEffective(
  range: RecurringRange,
  exceptions: SlotException[] | undefined,
  from: Date,
  to: Date,
) {
  return applyExceptions(
    range,
    expandOccurrences(range, from, to),
    exceptions,
    { from, to },
  );
}

/**
 * The occurrence that starts at `start` – the new time of a moved one, the
 * series time of a cancelled one.
 */
export function findEffectiveOccurrence(
  range: RecurringRange,
  exceptions: SlotException[] | undefined,
  start: Date,
) {
  return (
    expandEffective(
      range,
      exceptions,
      new Date(start.getTime() - MINUTE_MS),
      new Date(start.getTime() + MINUTE_MS),
    ).find((occurrence) => occurrence.start.getTime() === start.getTime()) ??
    null
  );
}

/** Whether [start, end] lies inside one occurrence that takes place. */
export function fitsEffectiveOccurrence(
  range: RecurringRange,
  exceptions: SlotException[] | undefined,
  start: Date,
  end: Date,
) {
  const margin = 24 * 60 * MINUTE_MS;
  return expandEffective(
    range,
    exceptions,
    new Date(start.getTime() - margin),
    new Date(end.getTime() + margin),
  ).some(
    (occurrence) =>
      occurrence.status !== 'cancelled' &&
      occurrence.start.getTime() <= start.getTime() &&
      end.getTime() <= occurrence.end.getTime(),
  );
}

/** Whether [start, end] lies inside a cancelled occurrence. */
export function insideCancelledOccurrence(
  range: RecurringRange,
  exceptions: SlotException[] | undefined,
  start: Date,
  end: Date,
) {
  if (!exceptions?.some((exception) => exception.cancelled)) return false;
  const margin = 24 * 60 * MINUTE_MS;
  return expandEffective(
    range,
    exceptions,
    new Date(start.getTime() - margin),
    new Date(end.getTime() + margin),
  ).some(
    (occurrence) =>
      occurrence.status === 'cancelled' &&
      occurrence.start.getTime() <= start.getTime() &&
      end.getTime() <= occurrence.end.getTime(),
  );
}

/** Exceptions per slot id, in one query. */
export async function loadSlotExceptions(
  prisma: PrismaService,
  slotIds: string[],
): Promise<Map<string, SlotException[]>> {
  const result = new Map<string, SlotException[]>();
  if (slotIds.length === 0) return result;
  const rows = await prisma.practiceSlotException.findMany({
    where: { practiceSlotId: { in: [...new Set(slotIds)] } },
    select: {
      practiceSlotId: true,
      originalStart: true,
      cancelled: true,
      newStart: true,
      newEnd: true,
      reason: true,
    },
  });
  for (const row of rows) {
    const list = result.get(row.practiceSlotId) ?? [];
    list.push({
      originalStart: row.originalStart,
      cancelled: row.cancelled,
      newStart: row.newStart,
      newEnd: row.newEnd,
      reason: row.reason,
    });
    result.set(row.practiceSlotId, list);
  }
  return result;
}

/** Fields the calendars send along with a team training occurrence. */
export function occurrenceChangeFields(occurrence: EffectiveOccurrence) {
  if (occurrence.status === 'scheduled') return {};
  return {
    occurrenceStatus: occurrence.status,
    originalStart: occurrence.originalStart.toISOString(),
    originalEnd: occurrence.originalEnd.toISOString(),
    changeReason: occurrence.reason,
  };
}
