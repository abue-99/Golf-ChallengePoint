import { expandOccurrences } from '../roster/roster.helpers';

/**
 * Whether [start, end] lies inside one real occurrence of the window. The
 * time-of-day check above compares UTC times, which fails for weekly
 * windows across a DST change (16:00 local is 14:00 UTC in summer and
 * 15:00 UTC in winter); a real occurrence is always right.
 */
export function fitsAnOccurrence(
  slot: {
    startTime: Date;
    endTime: Date;
    recurrence: string;
    recurrenceEndDate: Date | null;
  },
  start: Date,
  end: Date,
) {
  const margin = 24 * 60 * 60 * 1000;
  return expandOccurrences(
    slot,
    new Date(start.getTime() - margin),
    new Date(end.getTime() + margin),
  ).some(
    (occurrence) =>
      occurrence.start.getTime() <= start.getTime() &&
      end.getTime() <= occurrence.end.getTime(),
  );
}
