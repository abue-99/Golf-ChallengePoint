/**
 * Hit testing for drops from the lesson library onto FullCalendar. The
 * library uses dnd-kit (same sensors as the rest of the app), so the
 * calendar cells are found from the pointer position instead of via
 * droppables.
 */

export type DropTarget =
  | { kind: "event"; activityId: string; time: Date | null }
  | { kind: "time"; start: Date; ghost: GhostRect | null }
  | { kind: "day"; date: string };

/** Where to draw the preview box (viewport coordinates). */
export type GhostRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const SNAP_MINUTES = 15;

type DragEventLike = {
  activatorEvent: Event | null;
  delta: { x: number; y: number };
};

/** Current pointer position of a dnd-kit drag (mouse, touch or keyboard). */
export function pointerOf(
  event: DragEventLike,
): { x: number; y: number } | null {
  const start = event.activatorEvent;
  if (!start) return null;
  let x: number | null = null;
  let y: number | null = null;
  if (typeof TouchEvent !== "undefined" && start instanceof TouchEvent) {
    const touch = start.touches[0] ?? start.changedTouches[0];
    if (touch) {
      x = touch.clientX;
      y = touch.clientY;
    }
  } else if ("clientX" in start && "clientY" in start) {
    x = (start as MouseEvent).clientX;
    y = (start as MouseEvent).clientY;
  } else if (start.target instanceof Element) {
    // Keyboard: use the centre of the dragged row.
    const rect = start.target.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }
  if (x === null || y === null) return null;
  return { x: x + event.delta.x, y: y + event.delta.y };
}

function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function atLocal(date: string, minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00`);
}

/** The time grid row under the pointer, snapped to 15 minutes. */
function timeAt(elements: Element[], y: number) {
  const col = elements.find((el) =>
    el.matches("td.fc-timegrid-col[data-date]"),
  ) as HTMLElement | undefined;
  const lane = elements.find((el) =>
    el.matches("td.fc-timegrid-slot-lane[data-time]"),
  ) as HTMLElement | undefined;
  if (!col || !lane) return null;
  const date = col.dataset.date as string;
  const laneRect = lane.getBoundingClientRect();
  const laneMinutes = 30; // FullCalendar's default slot duration
  const offset = Math.min(
    Math.max((y - laneRect.top) / Math.max(laneRect.height, 1), 0),
    0.999,
  );
  const raw = minutesOf(lane.dataset.time as string) + offset * laneMinutes;
  const snapped = Math.floor(raw / SNAP_MINUTES) * SNAP_MINUTES;
  return { date, minutes: snapped, col, lane, laneRect, laneMinutes };
}

export function hitTest(
  root: HTMLElement | null,
  x: number,
  y: number,
  previewMinutes: number,
): DropTarget | null {
  if (!root || typeof document === "undefined") return null;
  const elements = document
    .elementsFromPoint(x, y)
    .filter((el) => root.contains(el));
  if (elements.length === 0) return null;

  const time = timeAt(elements, y);
  const eventEl = elements
    .map((el) => el.closest<HTMLElement>("[data-activity-id]"))
    .find(Boolean);
  if (eventEl?.dataset.activityId) {
    return {
      kind: "event",
      activityId: eventEl.dataset.activityId,
      time: time ? atLocal(time.date, time.minutes) : null,
    };
  }
  if (time) {
    const colRect = time.col.getBoundingClientRect();
    const pxPerMinute = time.laneRect.height / time.laneMinutes;
    const laneStart = minutesOf(time.lane.dataset.time as string);
    return {
      kind: "time",
      start: atLocal(time.date, time.minutes),
      ghost: {
        left: colRect.left + 2,
        width: colRect.width - 4,
        top: time.laneRect.top + (time.minutes - laneStart) * pxPerMinute,
        height: Math.max(previewMinutes * pxPerMinute, 12),
      },
    };
  }
  const day = elements.find((el) =>
    el.matches(".fc-daygrid-day[data-date]"),
  ) as HTMLElement | undefined;
  if (day?.dataset.date) return { kind: "day", date: day.dataset.date };
  return null;
}

export function sameTarget(a: DropTarget | null, b: DropTarget | null) {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "event" && b.kind === "event") {
    return (
      a.activityId === b.activityId &&
      (a.time?.getTime() ?? 0) === (b.time?.getTime() ?? 0)
    );
  }
  if (a.kind === "time" && b.kind === "time") {
    return (
      a.start.getTime() === b.start.getTime() &&
      a.ghost?.top === b.ghost?.top &&
      a.ghost?.left === b.ghost?.left
    );
  }
  if (a.kind === "day" && b.kind === "day") return a.date === b.date;
  return false;
}
