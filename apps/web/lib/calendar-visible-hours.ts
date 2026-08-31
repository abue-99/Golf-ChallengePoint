export const VISIBLE_DAY_START_MINUTES = 6 * 60;
export const VISIBLE_DAY_END_MINUTES = 21 * 60;

export const VISIBLE_DAY_START_TIME = `${String(Math.floor(VISIBLE_DAY_START_MINUTES / 60)).padStart(2, "0")}:${String(VISIBLE_DAY_START_MINUTES % 60).padStart(2, "0")}:00`;
export const VISIBLE_DAY_END_TIME = `${String(Math.floor(VISIBLE_DAY_END_MINUTES / 60)).padStart(2, "0")}:${String(VISIBLE_DAY_END_MINUTES % 60).padStart(2, "0")}:00`;

export type VisibleRange = { start: Date; end: Date };

export function classifyOutsideVisibleHours(
  eventStart: Date,
  eventEnd: Date,
  visibleRange: VisibleRange,
) {
  const start = eventStart > visibleRange.start ? eventStart : visibleRange.start;
  const end = eventEnd < visibleRange.end ? eventEnd : visibleRange.end;
  if (end <= start) return { before: false, after: false };

  let before = false;
  let after = false;
  const dayCursor = new Date(start);
  dayCursor.setHours(0, 0, 0, 0);

  while (dayCursor < end && (!before || !after)) {
    const dayStart = new Date(dayCursor);
    const dayEnd = new Date(dayCursor);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const segmentStart = start > dayStart ? start : dayStart;
    const segmentEnd = end < dayEnd ? end : dayEnd;

    const visibleStart = new Date(dayCursor);
    visibleStart.setHours(
      Math.floor(VISIBLE_DAY_START_MINUTES / 60),
      VISIBLE_DAY_START_MINUTES % 60,
      0,
      0,
    );
    const visibleEnd = new Date(dayCursor);
    visibleEnd.setHours(
      Math.floor(VISIBLE_DAY_END_MINUTES / 60),
      VISIBLE_DAY_END_MINUTES % 60,
      0,
      0,
    );

    if (segmentStart < visibleStart) before = true;
    if (segmentEnd > visibleEnd) after = true;

    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  return { before, after };
}
