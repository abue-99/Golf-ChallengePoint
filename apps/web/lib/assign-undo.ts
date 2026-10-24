/**
 * Undo for assignments the coach just made (bulk assign or drag & drop).
 * Backed by POST /api/coach/roster/undo, which only removes rows that are
 * still untouched by the player.
 */
export type CreatedIds = { lessonAssignmentIds: string[]; planIds: string[] };

export async function undoAssignments(ids: CreatedIds) {
  const res = await fetch("/api/coach/roster/undo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as {
    lessonsRemoved: number;
    journeysRemoved: number;
  };
}

type AssignResult =
  | {
      id?: string;
      playerPlanId?: string;
      assignments?: { id?: string | null; playerPlanId?: string | null }[];
    }
  | null
  | undefined
  | void;

/** Collects the ids an assign call created, whatever the target was. */
export function createdIdsFromResult(
  sourceType: "lesson" | "journey",
  result: unknown,
): CreatedIds {
  const r = (result ?? {}) as Exclude<AssignResult, void | null | undefined>;
  const created: CreatedIds = { lessonAssignmentIds: [], planIds: [] };
  if (sourceType === "lesson") {
    if (r.id) created.lessonAssignmentIds.push(r.id);
    (r.assignments ?? []).forEach((entry) => {
      if (entry.id) created.lessonAssignmentIds.push(entry.id);
    });
  } else {
    if (r.playerPlanId) created.planIds.push(r.playerPlanId);
    (r.assignments ?? []).forEach((entry) => {
      if (entry.playerPlanId) created.planIds.push(entry.playerPlanId);
    });
  }
  return created;
}

export function hasCreatedIds(ids: CreatedIds) {
  return ids.lessonAssignmentIds.length > 0 || ids.planIds.length > 0;
}
