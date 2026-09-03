export type CoachTelemetryEvent =
  | "LessonDragStarted"
  | "JourneyDragStarted"
  | "LessonAssignedToPlayer"
  | "LessonAssignedToTeam"
  | "JourneyAssignedToPlayer"
  | "JourneyAssignedToTeam"
  | "LessonAssignmentCancelled"
  | "LessonAssignmentUndone"
  | "QuickAssignOpened"
  | "QuickAssignCompleted"
  | "LessonDragStart"
  | "PlayerDropTargetEnter"
  | "PlayerDropTriggered"
  | "PlayerAssignmentRequest"
  | "PlayerAssignmentSuccess"
  | "PlayerAssignmentFailed";

export function trackCoachTelemetry(
  event: CoachTelemetryEvent,
  payload?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("coach-telemetry", {
      detail: { event, payload, timestamp: Date.now() },
    }),
  );
}
