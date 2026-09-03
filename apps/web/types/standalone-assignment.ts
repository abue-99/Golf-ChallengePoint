/**
 * Standalone Assignment types used by the Assignment-First model.
 * These are distinct from development-plan assignments.
 */
export type StandaloneAssignmentStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type StandaloneAssignmentTargetType = "PLAYER" | "TEAM" | "GROUP";
export type StandaloneAssignmentSourceType = "PLAYER" | "TEAM" | "GROUP";

export type StandaloneAssignment = {
  id: string;
  lessonId: string | null;
  targetType: StandaloneAssignmentTargetType;
  sourceType: StandaloneAssignmentSourceType;
  sourceReference: string | null;
  playerId: string | null;
  teamId: string | null;
  groupName: string | null;
  coachId: string;
  status: StandaloneAssignmentStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  isInTrainingQueue: boolean;
  dueDate: string | null;
  playerNotes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  lesson: {
    id: string;
    name: string;
    focusArea: string;
    durationMinutes: number | null;
    trainingObjective: string | null;
    successCriteria: string | null;
    plannedExercises: string | null;
    subCapability: string | null;
    subSubCapability: string | null;
  } | null;
  player: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  team: {
    id: string;
    shortName: string;
    icon: string | null;
  } | null;
  teamEvent: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  } | null;
  calendarTask: {
    id: string;
    title: string;
    description: string | null;
    scheduledDate: string;
    durationMinutes: number | null;
    status: string;
  } | null;
  itemType?: "lesson" | "journey";
  isNew?: boolean;
  source?: string;
  journeyTemplate?: {
    id: string;
    name: string;
    category: string | null;
    difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
    coverImageUrl: string | null;
  } | null;
  playerPlanId?: string | null;
};
