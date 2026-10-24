export type CalendarActivityType =
  | "practice-slot"
  | "team-practice"
  | "coach-assignment"
  | "lesson-mission"
  | "availability-block"
  | "team-event"
  | "tournament"
  | "milestone";

export type CalendarTaskStatus = "PLANNED" | "COMPLETED";
export type AvailabilityBlockType =
  | "SCHOOL"
  | "WORK"
  | "HOLIDAY"
  | "TRAVEL"
  | "CUSTOM";
export type TournamentPriority = "PRIORITY_1" | "PRIORITY_2" | "PRIORITY_3";

export type CalendarLessonSummary = {
  id: string;
  focusArea: string;
  trainingObjective?: string | null;
  successCriteria?: string | null;
  plannedExercises?: string | null;
  subCapability?: string | null;
  subSubCapability?: string | null;
  durationMinutes?: number;
  name?: string;
};

export type CalendarActivity = {
  id: string;
  sourceId: string;
  type: CalendarActivityType;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  ownerType?: "PLAYER" | "TEAM";
  teamName?: string | null;
  description?: string | null;
  durationMinutes?: number;
  status?: string;
  completedAt?: string | null;
  priority?: TournamentPriority | string;
  availabilityType?: AvailabilityBlockType;
  notes?: string | null;
  lesson?: CalendarLessonSummary | null;
  location?: string | null;
  planName?: string | null;
  blockName?: string | null;
  /** Team trainings and team events: id of this occurrence for attendance. */
  occurrenceKey?: string;
  /** The player's own answer for this occurrence, if any. */
  attendance?: { status: AttendanceStatus; note: string | null } | null;
};

export type AttendanceStatus = "GOING" | "MAYBE" | "NOT_GOING";

export type CalendarEventExtendedProps = CalendarActivity & {
  slotId?: string;
  occurrenceStart?: string;
  occurrenceEnd?: string;
};
