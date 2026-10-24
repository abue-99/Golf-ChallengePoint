import type { AttendanceStatus } from "./calendar";

export type CoachAttendance = {
  going: number;
  maybe: number;
  notGoing: number;
  open: number;
  members: number;
  responses: {
    playerId: string;
    name: string;
    status: AttendanceStatus;
    note: string | null;
  }[];
  openPlayers: { playerId: string; name: string }[];
};

export type CoachCalendarActivityType =
  | "team-practice"
  | "team-event"
  | "coach-assignment"
  | "tournament";

export type CoachCalendarActivity = {
  id: string;
  sourceId: string;
  type: CoachCalendarActivityType;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  teamIcon?: string | null;
  description?: string | null;
  location?: string | null;
  recurrence?: string;
  occurrenceKey?: string;
  attendance?: CoachAttendance | null;
  lessonId?: string | null;
  focusArea?: string | null;
  durationMinutes?: number;
  status?: string;
  playerName?: string | null;
  priority?: string;
  createdById?: string | null;
  createdByName?: string | null;
  lastReminder?: { sentAt: string; kind: "MANUAL" | "AUTO" | string } | null;
};

export type CoachCalendarTeam = {
  id: string;
  shortName: string;
  icon: string | null;
  memberCount: number;
  autoRemindHours: number | null;
  isHeadCoach: boolean;
};

export type CoachCalendarPayload = {
  viewerId?: string;
  range: { from: string; to: string };
  teams: CoachCalendarTeam[];
  activities: CoachCalendarActivity[];
};
