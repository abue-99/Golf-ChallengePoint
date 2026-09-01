export const CALENDAR_VIEW_STORAGE_KEY = "calendar:last-view";

export type CalendarView = "agenda" | "day" | "week" | "month";

const VALID_VIEWS: CalendarView[] = ["agenda", "day", "week", "month"];

function isCalendarView(value: string): value is CalendarView {
  return VALID_VIEWS.includes(value as CalendarView);
}

export function loadCalendarViewPreference(): CalendarView | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  return stored && isCalendarView(stored) ? stored : null;
}

export function saveCalendarViewPreference(view: CalendarView) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
}
