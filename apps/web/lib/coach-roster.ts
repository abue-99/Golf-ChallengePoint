import type { LearningProgressSummary } from "@/components/LearningProgress";
import type { ActivityDay } from "@/components/ActivityStrip";

export type RosterPlayer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  profileImage?: string | null;
  phoneNumber?: string | null;
  timezone?: string | null;
  lastLogin?: string | null;
  userClubs?: { clubId: string; club: { id: string; name: string } | null }[];
  coaches?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    /** The coach's role for this player (null = not specified). */
    role?: string | null;
  }[];
  /** This coach's own role for the player (linked players). */
  myRole?: string | null;
  /** True when the player is linked to the coach ("My Players"). */
  linked: boolean;
  teamIds: string[];
  /** Counts only this coach's lessons, journeys and plans. */
  learningProgress?: LearningProgressSummary | null;
  lastActivityAt?: string | null;
  days: ActivityDay[];
  currentJourney: {
    name: string;
    status: string;
    completedLessons: number;
    totalLessons: number;
  } | null;
  nextTournament: {
    title: string;
    location?: string | null;
    startTime: string;
    endTime: string;
    priority?: string | null;
  } | null;
  /** Completed lessons from this coach that the coach has not seen yet. */
  feedbackCount: number;
  /** Notes about the player this coach can read (own and shared). */
  noteCount: number;
  /** Journey templates from this coach the player has not finished yet. */
  openJourneyTemplateIds: string[];
};

export type AgendaItem = {
  kind: "window" | "event";
  title: string;
  start: string;
  end: string;
  location?: string | null;
  teamId?: string | null;
  playerId?: string | null;
  /** Team sessions only. */
  occurrenceKey?: string;
  attendance?: AttendanceSummary | null;
  /** A single date of a training that was moved or cancelled. */
  occurrenceStatus?: "moved" | "cancelled";
  originalStart?: string;
  changeReason?: string | null;
};

export type AttendanceSummary = {
  going: number;
  maybe: number;
  notGoing: number;
  open: number;
  members: number;
  responses: {
    playerId: string;
    status: "GOING" | "MAYBE" | "NOT_GOING";
    note: string | null;
  }[];
};

export type WeekTournament = {
  playerId: string;
  title: string;
  location?: string | null;
  startTime: string;
  endTime: string;
};

export type FeedbackItem = {
  id: string;
  completedAt: string | null;
  selfAssessment: number | null;
  playerNotes: string | null;
  player: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    profileImage?: string | null;
  } | null;
  lesson: { id: string; name: string; focusArea?: string | null };
  plan: { id: string; name: string } | null;
};

export type NoteVisibility = "PRIVATE" | "SHARED";

export type CoachNote = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** PRIVATE: only the author. SHARED: every coach of this player. */
  visibility: NoteVisibility;
  /** Written by the viewer (only the author edits or deletes). */
  mine: boolean;
  author: { id: string; firstName: string | null; lastName: string | null };
};

export type RosterTeam = {
  id: string;
  icon?: string | null;
  shortName: string;
  description?: string | null;
  category?: string | null;
  clubId?: string | null;
  memberIds: string[];
  pendingLessons: number;
  plans: {
    id: string;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
  }[];
  trainingWindowCount: number;
  nextTrainingWindow: { title: string; start: string; end: string } | null;
  coachId?: string;
  isHeadCoach?: boolean;
  myRole?: string | null;
  staff?: {
    coachId: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  }[];
};

export type RosterResponse = {
  timeZone: string;
  today: string;
  agenda: AgendaItem[];
  /** Team sessions of the next 7 days (after today), with attendance. */
  upcoming?: AgendaItem[];
  tournamentsThisWeek: WeekTournament[];
  feedbackTotal: number;
  firstDay: string;
  lastDay: string;
  teams: RosterTeam[];
  players: RosterPlayer[];
};

export const INACTIVE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function nameOf(player: Pick<RosterPlayer, "firstName" | "lastName" | "email">) {
  return (
    [player.firstName, player.lastName].filter(Boolean).join(" ") ||
    player.email ||
    "—"
  );
}

export function initialsOf(player: Pick<RosterPlayer, "firstName" | "lastName" | "email">) {
  const parts = nameOf(player).split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

export function daysSince(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
}

export function daysUntil(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / DAY_MS);
}

export function lastActiveLabel(player: RosterPlayer) {
  if (!player.lastLogin) return "Never logged in";
  const days = daysSince(player.lastActivityAt ?? player.lastLogin);
  if (days === null) return "Never logged in";
  if (days === 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 60) return `Active ${days} days ago`;
  return `Active ${Math.floor(days / 30)} months ago`;
}

/** Linked player who never activated the account or was idle for 14+ days. */
export function isInactive(player: RosterPlayer) {
  if (!player.linked) return false;
  if (!player.lastLogin) return true;
  const days = daysSince(player.lastActivityAt ?? player.lastLogin);
  return days === null || days >= INACTIVE_AFTER_DAYS;
}

export function pendingCount(player: RosterPlayer) {
  return (
    (player.learningProgress?.lessons?.PENDING ?? 0) +
    (player.learningProgress?.journeys?.PENDING ?? 0)
  );
}

export function missedCount(player: RosterPlayer) {
  return player.days.filter((day) => day.state === "missed").length;
}

export function needsAttention(player: RosterPlayer) {
  return (
    player.feedbackCount > 0 ||
    pendingCount(player) > 0 ||
    isInactive(player) ||
    missedCount(player) > 0
  );
}

/** Short text describing what the player is currently working on. */
export function workSummary(player: RosterPlayer) {
  if (player.currentJourney) {
    const { name, completedLessons, totalLessons } = player.currentJourney;
    return totalLessons > 0
      ? `${name} ${completedLessons}/${totalLessons}`
      : name;
  }
  const progress = player.learningProgress;
  const lessonsOpen =
    (progress?.lessons?.ACCEPTED ?? 0) + (progress?.lessons?.ACTIVE ?? 0);
  if (lessonsOpen > 0) {
    return `${lessonsOpen} open lesson${lessonsOpen === 1 ? "" : "s"}`;
  }
  return null;
}

export function formatDateTime(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

export function relativeDays(value: string) {
  const days = daysUntil(value);
  if (days === null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** Colour for a team: the circle colour if the icon is one, else the brand colour. */
export function teamColor(icon?: string | null) {
  return icon?.startsWith("circle:") ? icon.slice(7) : "var(--golf-primary)";
}

export function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
