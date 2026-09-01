import { CAPABILITY_DEFINITIONS, type CapabilityKey } from "@/lib/player-capabilities";

export const FOCUS_AREAS = [
  { value: "SETUP", label: "Setup" },
  { value: "PUTTING", label: "Putting" },
  { value: "SHORT_GAME", label: "Short Game" },
  { value: "LONG_GAME", label: "Long Game" },
  { value: "TACTICAL", label: "Tactical" },
  { value: "FITNESS", label: "Fitness" },
  { value: "MENTAL", label: "Mental" },
] as const;

/** Emoji icon for each FOCUS_AREA value. Used in UI lists and cards. */
export const FOCUS_AREA_EMOJI: Record<string, string> = {
  SETUP: "🏌️",
  PUTTING: "⛳",
  SHORT_GAME: "🎯",
  LONG_GAME: "💪",
  TACTICAL: "🧠",
  FITNESS: "🏃",
  MENTAL: "🧘",
};

export const LOCATIONS = [
  { value: "DRIVING_RANGE", label: "Driving Range" },
  { value: "SHORT_GAME_AREA", label: "Short Game Area" },
  { value: "PUTTING_GREEN", label: "Putting Green" },
  { value: "INDOOR_BAY", label: "Indoor Bay" },
  { value: "ON_COURSE", label: "On Course" },
] as const;

export function getLocationLabel(location: string): string {
  return LOCATIONS.find((l) => l.value === location)?.label ?? location;
}

export const LESSON_STATUSES = [
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
] as const;

export const LESSON_VISIBILITIES = [
  { value: "PUBLIC", label: "Public" },
  { value: "PRIVATE", label: "Private" },
] as const;

export const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
] as const;

export const GOAL_ACHIEVED_OPTIONS = [
  { value: "YES", label: "Yes" },
  { value: "PARTIALLY", label: "Partially" },
  { value: "NO", label: "No" },
] as const;

export const ASSIGNMENT_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export type LessonFocusArea = (typeof FOCUS_AREAS)[number]["value"];
export type LessonStatus = (typeof LESSON_STATUSES)[number]["value"];
export type LessonVisibility = (typeof LESSON_VISIBILITIES)[number]["value"];
export type LessonPriority = (typeof PRIORITIES)[number]["value"];
export type GoalAchieved = (typeof GOAL_ACHIEVED_OPTIONS)[number]["value"];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]["value"];
export type LegacyAssignmentStatus =
  | "OUTSTANDING"
  | "STARTED"
  | "FINISHED"
  | "REVIEWED";

export function normalizeAssignmentStatus(
  status?: string | null
): AssignmentStatus {
  switch (status) {
    case "NEW":
    case "OPEN":
    case "IN_PROGRESS":
    case "COMPLETED":
    case "ARCHIVED":
      return status;
    case "OUTSTANDING":
      return "OPEN";
    case "STARTED":
      return "IN_PROGRESS";
    case "FINISHED":
      return "COMPLETED";
    case "REVIEWED":
      return "ARCHIVED";
    default:
      return "OPEN";
  }
}

export function isPendingAssignmentStatus(status?: string | null): boolean {
  const normalized = normalizeAssignmentStatus(status);
  return normalized === "NEW" || normalized === "OPEN";
}

export function isStartedAssignmentStatus(status?: string | null): boolean {
  return normalizeAssignmentStatus(status) === "IN_PROGRESS";
}

export function isCompletedAssignmentStatus(status?: string | null): boolean {
  const normalized = normalizeAssignmentStatus(status);
  return normalized === "COMPLETED" || normalized === "ARCHIVED";
}

const FOCUS_AREA_CAPABILITY_KEY: Record<LessonFocusArea, CapabilityKey> = {
  SETUP: "setup",
  PUTTING: "putting",
  SHORT_GAME: "shortGame",
  LONG_GAME: "longGame",
  TACTICAL: "tactics",
  FITNESS: "fitness",
  MENTAL: "mental",
};

export function getFocusAreaPath(
  focusArea: string,
  subCapability?: string | null,
  subSubCapability?: string | null
): string {
  const focusLabel = FOCUS_AREAS.find((f) => f.value === focusArea)?.label ?? focusArea;
  if (!subCapability) return focusLabel;

  const capabilityKey = FOCUS_AREA_CAPABILITY_KEY[focusArea as LessonFocusArea];
  const capability = capabilityKey
    ? CAPABILITY_DEFINITIONS.find((c) => c.key === capabilityKey)
    : undefined;
  const sub = capability?.subs.find((s) => s.key === subCapability);
  const subLabel = sub?.label ?? subCapability;

  if (!subSubCapability) return `${focusLabel} / ${subLabel}`;

  const subSubLabel = sub?.subSubs?.find((ss) => ss.key === subSubCapability)?.label ?? subSubCapability;
  return `${focusLabel} / ${subLabel} / ${subSubLabel}`;
}

export function getSubCapabilitiesForFocusArea(focusArea?: string) {
  if (!focusArea) return [];
  const capabilityKey = FOCUS_AREA_CAPABILITY_KEY[focusArea as LessonFocusArea];
  if (!capabilityKey) return [];
  const capability = CAPABILITY_DEFINITIONS.find((item) => item.key === capabilityKey);
  if (!capability) return [];
  return capability.subs.map((sub) => ({ value: sub.key, label: sub.label }));
}

export function getSubSubCapabilitiesForFocusArea(focusArea?: string, subCapability?: string) {
  if (!focusArea || !subCapability) return [];
  const capabilityKey = FOCUS_AREA_CAPABILITY_KEY[focusArea as LessonFocusArea];
  if (!capabilityKey) return [];
  const capability = CAPABILITY_DEFINITIONS.find((item) => item.key === capabilityKey);
  const sub = capability?.subs.find((item) => item.key === subCapability);
  if (!sub) return [];
  return sub.subSubs.map((subSub) => ({ value: subSub.key, label: subSub.label }));
}

export interface LessonPlayer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  playerProfile?: { handicap?: number | null } | null;
}

export interface TrainingLesson {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  focusArea: LessonFocusArea;
  subCapability?: string | null;
  subSubCapability?: string | null;
  location?: string | null;
  status: LessonStatus;
  visibility: LessonVisibility;
  videoUrl?: string | null;
  coachId: string;
  playerId?: string | null;
  player?: LessonPlayer | null;
  coach?: { id: string; firstName?: string | null; lastName?: string | null; email: string } | null;
  trainingObjective?: string | null;
  currentSituation?: string | null;
  targetOutcome?: string | null;
  priority?: LessonPriority | null;
  plannedExercises?: string | null;
  successCriteria?: string | null;
  goalAchieved?: GoalAchieved | null;
  playerSelfAssessment?: number | null;
  coachRating?: number | null;
  afterSessionVideoUrl?: string | null;
  performanceScore?: number | null;
  comments?: string | null;
  keyLearnings?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LessonAssignment {
  id: string;
  blockId: string;
  lessonId: string;
  playerId: string;
  coachId: string;
  dueDate?: string | null;
  priority: LessonPriority;
  status: AssignmentStatus;
  sortOrder: number;
  playerNotes?: string | null;
  selfAssessment?: number | null;
  lesson: Pick<TrainingLesson, "id" | "name" | "focusArea" | "subCapability" | "subSubCapability" | "durationMinutes" | "trainingObjective" | "successCriteria" | "plannedExercises">;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingBlock {
  id: string;
  planId: string;
  coachId: string;
  name: string;
  description?: string | null;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder: number;
  assignments: LessonAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerDevelopmentPlan {
  id: string;
  name: string;
  description?: string | null;
  coachId: string;
  ownerType: "PLAYER" | "TEAM";
  playerId?: string | null;
  teamId?: string | null;
  coach?: { id: string; firstName?: string | null; lastName?: string | null; email: string } | null;
  player?: { id: string; firstName?: string | null; lastName?: string | null; email: string } | null;
  team?: { id: string; shortName: string; icon?: string | null } | null;
  startDate?: string | null;
  endDate?: string | null;
  blocks: TrainingBlock[];
  createdAt: string;
  updatedAt: string;
}
