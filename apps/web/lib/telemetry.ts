export type CoachTelemetryEvent =
  | "LessonDragStarted"
  | "LessonAssignedToPlayer"
  | "LessonAssignedToTeam"
  | "LessonAssignmentCancelled"
  | "LessonAssignmentUndone"
  | "QuickAssignOpened"
  | "QuickAssignCompleted";

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
