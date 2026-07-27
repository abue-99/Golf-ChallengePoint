export const FOCUS_AREAS = [
  { value: "SETUP", label: "Setup" },
  { value: "PUTTING", label: "Putting" },
  { value: "SHORT_GAME", label: "Short Game" },
  { value: "LONG_GAME", label: "Long Game" },
  { value: "TACTICAL", label: "Tactical" },
  { value: "FITNESS", label: "Fitness" },
  { value: "MENTAL", label: "Mental" },
] as const;

export const LOCATIONS = [
  { value: "DRIVING_RANGE", label: "Driving Range" },
  { value: "SHORT_GAME_AREA", label: "Short Game Area" },
  { value: "PUTTING_GREEN", label: "Putting Green" },
  { value: "INDOOR_BAY", label: "Indoor Bay" },
  { value: "ON_COURSE", label: "On Course" },
] as const;

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
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "STARTED", label: "Started" },
  { value: "FINISHED", label: "Finished" },
  { value: "REVIEWED", label: "Reviewed" },
] as const;

export type LessonFocusArea = (typeof FOCUS_AREAS)[number]["value"];
export type LessonStatus = (typeof LESSON_STATUSES)[number]["value"];
export type LessonVisibility = (typeof LESSON_VISIBILITIES)[number]["value"];
export type LessonPriority = (typeof PRIORITIES)[number]["value"];
export type GoalAchieved = (typeof GOAL_ACHIEVED_OPTIONS)[number]["value"];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]["value"];

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
  lesson: Pick<TrainingLesson, "id" | "name" | "focusArea" | "durationMinutes" | "trainingObjective" | "successCriteria" | "plannedExercises">;
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
  playerId: string;
  coach?: { id: string; firstName?: string | null; lastName?: string | null; email: string } | null;
  startDate?: string | null;
  endDate?: string | null;
  blocks: TrainingBlock[];
  createdAt: string;
  updatedAt: string;
}

