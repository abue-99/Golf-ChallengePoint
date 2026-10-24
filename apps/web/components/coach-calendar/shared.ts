import type {
  CoachAttendance,
  CoachCalendarActivity,
  CoachCalendarTeam,
} from "@/types/coach-calendar";

/** Fallback colours for teams whose icon is an emoji. */
const PALETTE = [
  "#16a34a",
  "#2563eb",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#ca8a04",
  "#4f46e5",
];

export type TeamColor = { solid: string; soft: string; text: string };

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const number = Number.parseInt(full, 16);
  if (Number.isNaN(number) || full.length !== 6) return null;
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

function soften(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#f1f5f9";
  const mix = (channel: number) => Math.round(channel + (255 - channel) * 0.85);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

function darken(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#0f172a";
  const mix = (channel: number) => Math.round(channel * 0.45);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

/** Stable colour per team: the circle colour of its icon, else a palette slot. */
export function teamColors(teams: CoachCalendarTeam[]) {
  const map = new Map<string, TeamColor>();
  teams.forEach((team, index) => {
    const solid =
      team.icon &&
      team.icon.startsWith("circle:") &&
      hexToRgb(team.icon.slice(7))
        ? team.icon.slice(7)
        : PALETTE[index % PALETTE.length];
    map.set(team.id, { solid, soft: soften(solid), text: darken(solid) });
  });
  return map;
}

export const NEUTRAL_COLOR: TeamColor = {
  solid: "#64748b",
  soft: "#f1f5f9",
  text: "#1e293b",
};

/** Team sessions the players are asked to answer for. */
export function isTeamSession(activity: CoachCalendarActivity) {
  return activity.type === "team-practice" || activity.type === "team-event";
}

export function hasOpenAnswers(activity: CoachCalendarActivity) {
  return Boolean(activity.attendance && activity.attendance.open > 0);
}

export function attendanceLabel(attendance: CoachAttendance) {
  return `${attendance.going} going, ${attendance.maybe} maybe, ${attendance.notGoing} not going, ${attendance.open} no answer`;
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDay(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatRange(start: string, end: string) {
  return `${formatDay(start)} · ${formatTime(start)}–${formatTime(end)}`;
}

/** YYYY-MM-DD in the browser's time zone. */
export function localDayKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const TYPE_LABEL: Record<CoachCalendarActivity["type"], string> = {
  "team-practice": "Team training",
  "team-event": "Team event",
  "coach-assignment": "Session",
  tournament: "Tournament",
};
